import express from "express";
import {
  deleteFileController,
  uploadFileController,
  uploadMultipleFilesController,
} from "../controllers/file.controller";
import { upload } from "../middlewares/multer.middleware";

const fileRouter = express.Router();

fileRouter.post("/upload", upload.single("file"), uploadFileController);
fileRouter.post("/upload-multiple", upload.array("files"), uploadMultipleFilesController);
fileRouter.delete("/delete", deleteFileController);

export default fileRouter;
