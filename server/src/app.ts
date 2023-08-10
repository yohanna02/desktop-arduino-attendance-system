import express from "express";
import http from "http";
import mongoose from "mongoose";
import ws from "ws";
import { v4 as uuidV4 } from "uuid";
import api from "./api";

mongoose.connect("mongodb://localhost/attendance-system").then(() => {
    console.log("Connected to DB");
});

const app = express();

const server = http.createServer(app);

app.use(express.json());
app.use("/api", api);

const port = 3000;

server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

const socketServer = new ws.Server({server});

// export const isFullValidQuery = (query: unknown): query is QueryI => {
//     if (query !== null && typeof query === "object") {
//         return "noPerPage" in query && "pageNo" in query;
//     }

//     return false;
// }
const deviceMap = new Map<"esp" | "desktop", ws>();

socketServer.on("connection", (ws) => {
    ws.on("message", (rawData) => {
        const data = JSON.parse(rawData.toString());
        console.log(data);
        
        if (data.event === "set-device") {
            if (data.device === "esp") {
                deviceMap.set("esp", ws);
            }
            else if (data.device === "desktop") {
                deviceMap.set("desktop", ws);
            }
        }
        else if (data.event === "enroll") {
            const desktopWs = deviceMap.get("desktop");
            if (desktopWs) {
                desktopWs.send(rawData);
            }
        }
    });
});
