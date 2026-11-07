import { spawn } from "child_process";
import os from "os";
import { sleep } from "./utils.js";

let serverProcess = null;
let vpnProcess = null;
let socket = null;

export let sv_data = {
  state: "off",
  players: [],
  startedAt: null,
  timeOut: 0,
  logs: [""],
};

async function startIdleTimeout(time = 600) {
  sv_data.timeOut = time;
  console.log("PRIMER TIMEOUT:", sv_data.timeOut);
  const startingTime = Date.now(); //guardamos el instante (en milis)
  //itero con variable global para hacer seguimiento en sv_data
  while (sv_data.timeOut > 0 && sv_data.players.length === 0) {
    const passedTimeMillis = Date.now() - startingTime; //miliseg que pasaron desde el startingTime
    sv_data.timeOut = time - Math.trunc(passedTimeMillis / 1000);

    console.log(sv_data.timeOut);
    await sleep(0.5);
  }
  //si paso el tiempo (no se unio nadie) apagamos
  if (sv_data.timeOut < 0 && sv_data.state === "started") {
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

function manageLog(log) {
  sv_data.logs.push(log); //guarda el registro en svData
  socket.emit("newLog", log);
}

async function serverListener() {
  startIdleTimeout();
  serverProcess.stdout.on("data", (data) => {
    const text = data.toString();

    manageLog(text);

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

export function registerServerSocketHandlers(ioSocket) {
  //guardamos el socket en la variable global del modulo, para poder usarlo en otras funciones
  socket = ioSocket;

  socket.on("fetchData", async (callback) => {
    callback(sv_data);
  });

  socket.on("changeState", async (newState) => {
    if (sv_data.state === "starting" || sv_data.state === "stoping") return;
    if (sv_data.state === newState) return;

    try {
      if (newState === "started") {
        sv_data.state = "starting";
        socket.emit("update_sv_data", sv_data);
        await startServer();

        sv_data.state = "started";
        sv_data.startedAt = Date.now();
        socket.emit("update_sv_data", sv_data);
      } else if (newState === "off") {
        sv_data.state = "closing";
        socket.emit("update_sv_data", sv_data);
        await stopServer();

        sv_data.state = "off";
        sv_data.startedAt = null;
        sv_data.players = [];
        socket.emit("update_sv_data", sv_data);
      }
    } catch (error) {
      console.error("Error prendiendo/apagando", error);
      sv_data.state = "Error";
      sv_data.startedAt = null;
      socket.emit("update_sv_data", sv_data);
    }
  });
}

//devuelve una promesa que se resuelve al iniciar el server
export function startServer() {
  return new Promise((resolve, reject) => {
    if (serverProcess) {
      throw new Error("El server ya está prendido");
    }
    //guardo el path de la carpeta del server NeoForge
    const serverPath = `${os.homedir()}/Desktop/Forge-1.20.1`;

    sv_data.logs = [""]; //borramos los logs viejos

    //levantamos una terminal y empezamos a iniciar el server
    serverProcess = spawn("./run.sh", {
      cwd: serverPath, //nos ubicamos en la carpeta del server, no podemos ~/Desktop/neoforge/run.sh porque Error: could not open `user_jvm_args.txt'
    });
    //generamos un listener por cada vez que se escribe algo en la terminal (STanDard OUTput)
    serverProcess.stdout.on("data", (data) => {
      //convertimos el Buffer Object a string
      const text = data.toString();

      // Detectar cuando termina y resuelve la promesa
      if (text.includes('For help, type "help"')) {
        manageLog(text);
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
export function stopServer() {
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

import { exec } from "child_process";

export function startVpn() {
  const child = exec("playit");

  child.stdout.on("data", (data) => {
    console.log(data);

    if (data.includes("agent registered")) {
      console.log("Tunel iniciado!");
    }
  });
}
