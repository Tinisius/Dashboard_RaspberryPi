import { io } from "socket.io-client";
import { getStats } from "./system.js";

const socket = io("http://tinisius.site");

console.log("conectar:");
socket.emit("raspi_conn", (conn) => {
  console.log(conn);
});

socket.on("fetchResources", async (callback) => {
  console.log("me hicieron una request");

  callback(await getStats());
});
