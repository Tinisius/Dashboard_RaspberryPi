import { io } from "socket.io-client";
import { getStats } from "./system.js";

const sleep = (sec) =>
  new Promise((resolve) => setTimeout(resolve, sec * 1000));

const socket = io("https://tinisius.site");

socket.on("connect", () => {
  console.log("Conectado al servidor");
});

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

//se revive el socket cada 5min
KeepConnection();

socket.on("fetchResources", async (callback) => {
  console.log("me hicieron una request");

  callback(await getStats());
});
