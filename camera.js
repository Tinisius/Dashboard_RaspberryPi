import { spawn } from "child_process";

//arranca el proceso de la camara y setea listeners
export function startCamera(socket) {
  const ffmpeg = spawn("ffmpeg", [
    "-f",
    "v4l2",
    "-framerate",
    "30",
    "-video_size",
    "640x480",
    "-i",
    "/dev/video0",
    "-vf",
    "fps=10",
    "-q:v",
    "5",
    "-f",
    "image2pipe",
    "-vcodec",
    "mjpeg",
    "pipe:1",
  ]);
  let buffer = Buffer.alloc(0);

  //es un listener (no bloquea el proceso), envia datos cada ve que llegan
  ffmpeg.stdout.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);

    while (true) {
      // Buscar inicio de JPEG: FF D8
      const start = buffer.indexOf(Buffer.from([0xff, 0xd8]));

      if (start === -1) {
        buffer = buffer.subarray(-1);
        break;
      }

      // Descartar datos anteriores al JPEG
      if (start > 0) {
        buffer = buffer.subarray(start);
      }

      // Buscar final de JPEG: FF D9
      const end = buffer.indexOf(Buffer.from([0xff, 0xd9]), 2);

      if (end === -1) break;

      // Extraer imagen completa
      const frame = buffer.subarray(0, end + 2);

      // Enviar al servidor Socket.IO
      if (socket.connected) {
        console.log("frame: enviando al socket");
        socket.emit("camera:frame", frame);
      }

      // Continuar con los datos restantes
      buffer = buffer.subarray(end + 2);
    }
  });

  ffmpeg.stderr.on("data", (data) => {
    // FFmpeg escribe sus mensajes de diagnóstico aquí
    // console.log(data.toString());
    socket.emit("camera:frame", "error:" + data.toString());
  });

  ffmpeg.on("error", (err) => {
    console.error("Error iniciando FFmpeg:", err);
  });

  ffmpeg.on("close", (code) => {
    console.log("FFmpeg terminó. Código:", code);
  });

  console.log("Captura de cámara iniciada");

  return ffmpeg;
}
