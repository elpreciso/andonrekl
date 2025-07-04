const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Sirve archivos estáticos desde la raíz del proyecto
app.use(express.static(__dirname));

let users = {}; // socket.id -> {estacion: string, tipo: "supervisor"|"estacion"}
let rojas = new Set(); // estaciones en alerta roja
let amarillas = new Set(); // estaciones en alerta amarilla

function emitirEstado() {
  io.emit("estado", {
    rojas: Array.from(rojas),
    amarillas: Array.from(amarillas)
  });
}

io.on("connection", (socket) => {
  let tipo = null;
  let estacion = null;

  socket.on("registrar", (opcion) => {
    if (opcion === "supervisor") {
      tipo = "supervisor";
      users[socket.id] = { tipo: "supervisor" };
    } else {
      tipo = "estacion";
      estacion = String(opcion);
      users[socket.id] = { tipo: "estacion", estacion };
    }
    emitirEstado();
  });

  socket.on("activarRojo", () => {
    if (tipo !== "estacion" || !estacion) return;
    rojas.add(estacion);
    amarillas.delete(estacion); // Rojo tiene prioridad
    emitirEstado();
  });

  socket.on("desactivarRojo", () => {
    if (tipo !== "estacion" || !estacion) return;
    rojas.delete(estacion); // <-- Solo quita la estación de la alerta roja
    emitirEstado();
  });

  socket.on("activarAmarillo", () => {
    if (tipo !== "estacion" || !estacion) return;
    if (!rojas.has(estacion)) amarillas.add(estacion);
    emitirEstado();
  });

  socket.on("desactivarAmarillo", () => {
    if (tipo !== "estacion" || !estacion) return;
    amarillas.delete(estacion);
    emitirEstado();
  });

  socket.on("disconnect", () => {
    if (tipo === "estacion" && estacion) {
      rojas.delete(estacion);
      amarillas.delete(estacion);
    }
    delete users[socket.id];
    emitirEstado();
  });
});

// Escucha en todas las interfaces de red
server.listen(3000, '0.0.0.0', () => {
  console.log("Servidor disponible en http://localhost:3000");
});
