import {
  _deleteFileService,
  _uploadFileService,
} from "../services/file.service";

const uploadFileController = async (req: any, res: any) => {
  try {
    if (!req.file)
      return res.status(400).json({ message: "No file uploaded." });

    const uploadedFile = await _uploadFileService(req.file);
    return res
      .status(201)
      .json({ message: "File uploaded", data: uploadedFile });
  } catch (error: any) {
    console.error("Upload error:", error);
    return res
      .status(500)
      .json({ message: "Upload failed", error: error.message });
  }
};

const deleteFileController = async (req: any, res: any) => {
  try {
    const { file_id } = req.body;
    const result = await _deleteFileService(file_id);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error("Delete error:", error);
    return res
      .status(500)
      .json({ message: "Delete failed", error: error.message });
  }
};

export { uploadFileController, deleteFileController };
