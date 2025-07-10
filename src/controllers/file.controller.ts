import {
  _deleteFileService,
  _uploadFileService,
  _uploadMultipleFilesService,
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

const uploadMultipleFilesController = async (req: any, res: any) => {
  try {
    const files = req.files as Express.Multer.File[];
    // const uploadedBy = req.user?.id;

    const results = await _uploadMultipleFilesService(files);
    res.status(201).json({ message: "Files uploaded", data: results });
  } catch (error: any) {
    console.error("Upload error:", error);
    res.status(500).json({ message: error.message });
  }
};

export {
  uploadFileController,
  deleteFileController,
  uploadMultipleFilesController,
};
