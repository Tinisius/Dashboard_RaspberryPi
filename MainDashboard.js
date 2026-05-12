import { io } from "socket.io-client";
import { getStats } from "./system.js";

const socket = io("https://tinisius.site");

socket.on("connect", () => {
  console.log("Conectado al servidor");
});

console.log("emito conexion rasp:");
socket.emit("raspi_conn", (conn) => {
  console.log(conn);
});

socket.on("fetchResources", async (callback) => {
  console.log("me hicieron una request");

  callback(await getStats());
});
