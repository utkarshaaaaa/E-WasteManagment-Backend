const { V2 } = require("paseto");
const dotenv = require("dotenv");

dotenv.config();

const PUBLIC_KEY = process.env.PASETO_PUBLIC_KEY.replace(/\\n/g, "\n");

async function authMiddleware(req, res, next) {
  try {
    const authToken = req.headers.authorization;
    // const authToken = req.cookies.access_token; //When using cookies
    if (!authToken)
      return res.status(401).json({ message: "No token provided" });

    const token = authToken.split(" ")[1];

    const payload = await V2.verify(token, PUBLIC_KEY);

    req.user = payload;
    next();
  } catch (err) {
    console.error(err);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

module.exports = authMiddleware;



// export const pasetoAuth = async (req, res, next) => {
//   try {
  
//     const token = req.cookies?.access_token;

//     if (!token) {
//       return res.status(401).json({ error: "No token provided" });
//     }

//     const payload = await V2.verify(token, PUBLIC_KEY);

//     req.user = {
//       id: payload.id,
//       name: payload.name,
//     };

//     next();
//   } catch (err) {
//     return res.status(401).json({ error: "Invalid or expired token" });
//   }
// };
