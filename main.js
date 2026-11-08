import { io } from "socket.io-client";
import { getStats } from "./system.js";
import { sleep } from "./utils.js";
import { startVpn, registerServerSocketHandlers } from "./serverManagement.js";
import { startCamera } from "./camera.js";

//---------------------------------------------------------------------------------------

async function KeepConnection() {
  while (true) {
    socket.emit("raspi_conn", (conn) => {
      //si conecta podria ir un console.log
    });
    //espera 10 seg
    await sleep(10);
  }
}

startVpn();

let cameraProcess;
let cameraIdleTimer;

const socket = io("https://tinisius.site");
//const socket = io("http://localhost:8000");

function keepCameraAlive() {
  if (!cameraProcess) {
    //si es la primera vez arranca el proceso
    cameraProcess = startCamera(socket);
    cameraProcess.once("close", () => {
      cameraProcess = null;
      clearTimeout(cameraIdleTimer);
    });
  }

  //borra el timer anterior
  clearTimeout(cameraIdleTimer);
  //genera un nuevo timer, luego de 5 segundos mata el proceso
  cameraIdleTimer = setTimeout(() => cameraProcess.kill(), 5000);
}

socket.on("connect", () => {
  console.log("Conectado al servidor");
});

//se revive el socket cada 5min
KeepConnection();

//se encarga de recibir las peticiones del servidor de MC, asi como modificar los datos del sv, etc
registerServerSocketHandlers(socket);

//piden recursos, devuelvo
socket.on("fetchResources", async (callback) => {
  callback(await getStats());
  console.log("fetchResources");
});

socket.on("keepAliveCamera", () => {
  keepCameraAlive();
});
