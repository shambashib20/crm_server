import express from "express";
import {
  deleteFileController,
  uploadFileController,
} from "../controllers/file.controller";
import { upload } from "../middlewares/multer.middleware";

const fileRouter = express.Router();

fileRouter.post("/upload", upload.single("file"), uploadFileController);

fileRouter.delete("/delete", deleteFileController);

export default fileRouter;
