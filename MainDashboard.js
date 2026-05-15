import { io } from "socket.io-client";
import { getStats } from "./system.js";
import { Socket } from "socket.io-client";
import { spawn } from "child_process";
import os from "os";

let serverState = "off";
let serverProcess = null;

const sleep = (sec) =>
  new Promise((resolve) => setTimeout(resolve, sec * 1000));

//---------------------------------------------------------------------------------------
/*
function testStart() {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve();
    }, 5000);
  });
}
function testStop() {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve();
    }, 5000);
  });
}
*/

//devuelve una promesa que se resuelve al iniciar el server
function startServer() {
  return new Promise((resolve, reject) => {
    if (serverProcess) {
      throw new Error("El server ya está prendido");
    }
    //guardo el path de la carpeta del server NeoForge
    const serverPath = `${os.homedir()}/Desktop/NeoForge-21.1`;

    //levantamos una terminal y empezamos a iniciar el server
    const serverProcess = spawn("./run.sh", {
      cwd: serverPath, //nos ubicamos en la carpeta del server, no podemos ~/Desktop/neoforge/run.sh porque Error: could not open `user_jvm_args.txt'
      shell: true,
    });
    //generamos un listener por cada vez que se escribe algo en la terminal (STanDard OUTput)
    serverProcess.stdout.on("data", (data) => {
      //convertimos el Buffer Object a string
      const text = data.toString();

      console.log(text);

      // Detectar cuando termina y resuelve la promesa
      if (text.includes('For help, type "help"')) {
        resolve();
      }
    });

    //al encontrar errores, muestra por pantalla (puede que lo borre)
    serverProcess.stderr.on("data", (data) => {
      console.error(data.toString());
    });

    //al encontrar un error rechaza
    serverProcess.on("error", reject);
  });
}

//devuelve una promesa que se resuelve al apagar el server
function stopServer() {
  return new Promise((resolve) => {
    //evitamos apagarlo si ya esta apagado
    if (!serverProcess) {
      console.log("no hay proceso que cerrar???");
      resolve();
      return;
    }

    // Esperar cierre completo
    serverProcess.on("close", () => {
      console.log("🔴 Server apagado");

      // IMPORTANTE
      serverProcess = null;

      resolve();
    });

    //cerramos el server
    serverProcess.stdin.write("stop\n");
  });
}
//---------------------------------------------------------------------------------------

async function KeepConnection() {
  while (true) {
    console.log("reconectando...");
    socket.emit("raspi_conn", (conn) => {
      console.log(conn);
    });
    //espera 5 min
    await sleep(300);
  }
}

const socket = io("https://tinisius.site");
//const socket = io("http://localhost:8000");

socket.on("connect", () => {
  console.log("Conectado al servidor");
});
//se revive el socket cada 5min
KeepConnection();

//piden recursos, devuelvo
socket.on("fetchResources", async (callback) => {
  callback(await getStats());
});

//piden estado del sv, devuelvo
socket.on("fetchState", async (callback) => {
  console.log("me hicieron una request state");
  callback(serverState); //devuelve
});

socket.on("changeState", async (newState) => {
  //valida no molestar los procesos pendientes
  if (newState === "starting" || newState === "stoping") return;
  //valida no prender lo prendido o apagar lo apagado
  if (serverState === newState) return;

  try {
    //iniciar el server
    if (newState === "started") {
      socket.emit("update_sv", "starting");
      serverState = "starting";
      await startServer();
      socket.emit("update_sv", "started");
      serverState = "started";
    }
    //apagar el server
    else if (newState === "off") {
      socket.emit("update_sv", "closing");
      serverState = "closing";
      await stopServer();
      socket.emit("update_sv", "off");
      serverState = "off";
    }
  } catch (error) {
    //la idea seria caer aca solo si se corta el flujo
    console.error("Error prendiendo/apagando", error);
    socket.emit("update_sv", "error");
    serverState = "Error";
  }
});
