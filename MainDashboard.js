import { io } from "socket.io-client";
import { getStats } from "./system.js";
import { Socket } from "socket.io-client";
import { spawn } from "child_process";
import os from "os";

let serverProcess = null;
let vpnProcess = null;

let sv_data = {
  state: "off",
  players: [],
  startedAt: null,
  timeOut: 0,
};

const sleep = (sec) =>
  new Promise((resolve) => setTimeout(resolve, sec * 1000));

//---------------------------------------------------------------------------------------

async function startIdleTimeout(time = 300) {
  sv_data.timeOut = time;
  //itero con variable global para hacer seguimiento en sv_data
  while (sv_data.timeOut > 0 && sv_data.players.length === 0) {
    sv_data.timeOut--;
    await sleep(1);
  }
  //si paso el tiempo (no se unio nadie) apagamos
  if (sv_data.timeOut === 0 && sv_data.state === "started") {
    sv_data.state = "closing";
    socket.emit("update_sv_data", sv_data);
    await stopServer();

    sv_data.state = "off";
    sv_data.startedAt = null;
    sv_data.players = []; //por si alguien se mete en el ultimo segundo?
    socket.emit("update_sv_data", sv_data);
  }
  sv_data.timeOut = 0;
  return;
}

async function serverListener() {
  startIdleTimeout();
  serverProcess.stdout.on("data", (data) => {
    const text = data.toString();
    console.log(text);
    if (text.includes("joined the game")) {
      const match = text.match(/:\s(.+?) joined the game/);
      sv_data.players.push(match[1]);
      socket.emit("update_sv_data", sv_data);
    }
    if (text.includes("left the game")) {
      const match = text.match(/:\s(.+?) left the game/);
      sv_data.players = sv_data.players.filter((item) => item !== match[1]); //elimina ese jugador del array

      if (sv_data.players.length === 0) {
        startIdleTimeout();
      }
      //OJO! Podria pasar que el emit se ejecute ANTES que startIdleTimeout() setee sv_data.timeOut
      socket.emit("update_sv_data", sv_data);
    }
  });

  serverProcess.once("close", () => {
    return;
  });
}

//devuelve una promesa que se resuelve al iniciar el server
function startServer() {
  return new Promise((resolve, reject) => {
    if (serverProcess) {
      throw new Error("El server ya está prendido");
    }
    //guardo el path de la carpeta del server NeoForge
    const serverPath = `${os.homedir()}/Desktop/NeoForge-21.1`;

    //levantamos una terminal y empezamos a iniciar el server
    serverProcess = spawn("./run.sh", {
      cwd: serverPath, //nos ubicamos en la carpeta del server, no podemos ~/Desktop/neoforge/run.sh porque Error: could not open `user_jvm_args.txt'
      shell: true,
    });
    //generamos un listener por cada vez que se escribe algo en la terminal (STanDard OUTput)
    serverProcess.stdout.on("data", (data) => {
      //convertimos el Buffer Object a string
      const text = data.toString();

      // Detectar cuando termina y resuelve la promesa
      if (text.includes('For help, type "help"')) {
        serverListener(); //queda en background escuchando todos los eventos del server
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
      resolve();
      return;
    }

    // Esperar cierre completo
    serverProcess.on("close", () => {
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

async function startVpn() {
  vpnProcess = spawn("bash", ["-c", "playit"], {
    shell: true,
  });
  vpnProcess.stdout.on("data", (data) => {
    const text = data.toString();
    if (text.includes("agent registered")) {
      //no funciona
      console.log("Tunel iniciado!");
    }
  });
}

startVpn();

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
socket.on("fetchData", async (callback) => {
  console.log("me hicieron una request state");
  callback(sv_data); //devuelve
});

//cambia el estado del servidor (off->on u on->off) y avisa de ese cambio
socket.on("changeState", async (newState) => {
  if (sv_data.state === "starting" || sv_data.state === "stoping") return;
  if (sv_data.state === newState) return;

  try {
    //iniciar el server
    if (newState === "started") {
      sv_data.state = "starting";
      socket.emit("update_sv_data", sv_data); //se manda el starting
      await startServer();

      sv_data.state = "started";
      sv_data.startedAt = Date.now();
      socket.emit("update_sv_data", sv_data); //se manda started y la hora de apertura
    }
    //apagar el server
    else if (newState === "off") {
      sv_data.state = "closing";
      socket.emit("update_sv_data", sv_data); //se manda el closing
      await stopServer();

      sv_data.state = "off";
      sv_data.startedAt = null;
      sv_data.players = [];
      socket.emit("update_sv_data", sv_data); //se manda off y la hora de apertura=null
    }
  } catch (error) {
    //la idea seria caer aca solo si se corta el flujo
    console.error("Error prendiendo/apagando", error);
    sv_data.state = "Error";
    sv_data.startedAt = null;
    socket.emit("update_sv_data", sv_data);
  }
});
