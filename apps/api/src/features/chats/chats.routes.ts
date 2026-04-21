import { Router } from "express";
import { createChat, listChats, getChat, deleteChat, sendMessage, } from "./chats.controller";
import { requireAuth } from "../../middleware/auth";
import { chatLimiter } from "../../lib/rate-limit";


export const chatRouter: Router = Router();

chatRouter.use(requireAuth);
chatRouter.use(chatLimiter);

chatRouter.post("/", createChat);
chatRouter.get("/", listChats);
chatRouter.get("/:id", getChat);
chatRouter.delete("/:id", deleteChat);
chatRouter.post("/:id/messages", sendMessage);