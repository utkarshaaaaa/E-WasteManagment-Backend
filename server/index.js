const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const router = require("./Routers/router");
const auth = require("./Routers/auth");
const chatRoutes = require("./Routers/chatRoutes");
const setupSocket = require("./config/socket");

const app = express();
const server = http.createServer(app); 
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true, 
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());
app.use(cookieParser());

mongoose
  .connect(process.env.MONGODB_CONNECT_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));


const io = setupSocket(server); 
app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use("/", router);
app.use("/auth", auth);
app.use("/chat", chatRoutes);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(` Server running at http://localhost:${PORT}`);
});
