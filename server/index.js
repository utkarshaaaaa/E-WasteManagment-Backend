const express = require('express');
const app = express();
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();
const router = require("./Routers/router");
const { env } = require('process');
const auth = require("./Routers/auth");
const cookieParser = require("cookie-parser");


app.use(express.json());
app.use(cors());
app.use("/", router);
app.use("/auth", auth);
app.use(cookieParser());
mongoose.connect(process.env.MONGODB_CONNECT_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("Mongo connected"))
.catch(err => console.error("MongoDB connection error:", err));

app.listen(env.PORT, () => {
    console.log(`Server is listening at http://localhost:${env.PORT}`);
});