import { io } from "socket.io-client";
import { getStats } from "./system.js";
import { sleep } from "./utils.js";
import { startVpn, registerServerSocketHandlers } from "./serverManagement.js";

//---------------------------------------------------------------------------------------

async function KeepConnection() {
  while (true) {
    socket.emit("raspi_conn", (conn) => {
      console.log(conn);
    });
    //espera 1 seg
    await sleep(10);
  }
}

startVpn();

const socket = io("https://tinisius.site");
//const socket = io("http://localhost:8000");

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
});
