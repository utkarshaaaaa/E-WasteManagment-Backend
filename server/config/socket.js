const { Server } = require("socket.io");
const { V2 } = require("paseto");

module.exports = function setupSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: "*",
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Unauthorized"));

      const payload = await V2.verify(
        token,
        process.env.PASETO_PUBLIC_KEY.replace(/\\n/g, "\n")
      );

      socket.user = payload;
      next();
    } catch (err) {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    console.log("🔌 Socket connected:", socket.user.id);

    socket.on("joinChat", (chatGroupId) => {
      socket.join(chatGroupId);
    });

    socket.on("disconnect", () => {
      console.log("❌ Socket disconnected:", socket.user.id);
    });
  });

  return io;
};

// const { Server } = require("socket.io");

// module.exports = function setupSocket(server) {
//   const io = new Server(server, {
//     cors: { origin: "*" },
//   });

//   io.on("connection", (socket) => {
//     console.log("Socket connected:", socket.id);

//     socket.on("joinChat", (chatGroupId) => {
//       socket.join(chatGroupId);
//     });

//     socket.on("disconnect", () => {
//       console.log("Socket disconnected");
//     });
//   });

//   return io;
// };
