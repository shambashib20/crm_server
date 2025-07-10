import imagekit from "../../config/imagekit.service";
import File from "../models/file.model";

const _uploadFileService = async (
  file: Express.Multer.File,
  uploadedBy?: string
) => {
  const uploadResult = await imagekit.upload({
    file: file.buffer,
    fileName: file.originalname,
  });

  const savedFile = await File.create({
    file_url: uploadResult.url,
    file_id: uploadResult.fileId,
    name: uploadResult.name,
    type: file.mimetype,
    uploaded_by: uploadedBy,
    meta: {
      size: file.size,
    },
  });

  return savedFile;
};

const _deleteFileService = async (file_id: string) => {
  if (!file_id) {
    throw new Error("file_id is required");
  }
  await imagekit.deleteFile(file_id);

  const deletedFile = await File.findOneAndDelete({ file_id });

  return {
    message: "File deleted successfully",
    deletedFromDB: !!deletedFile,
  };
};

const _uploadMultipleFilesService = async (
  files: Express.Multer.File[],
  uploadedBy?: string
) => {
  if (!files || files.length === 0) {
    throw new Error("No files provided for upload");
  }

  const uploadResults = await Promise.all(
    files.map(async (file) => {
      const uploadResult = await imagekit.upload({
        file: file.buffer,
        fileName: file.originalname,
      });

      const savedFile = await File.create({
        file_url: uploadResult.url,
        file_id: uploadResult.fileId,
        name: uploadResult.name,
        type: file.mimetype,
        uploaded_by: uploadedBy,
        meta: {
          size: file.size,
        },
      });

      return savedFile;
    })
  );

  return uploadResults;
};

export { _uploadFileService, _deleteFileService, _uploadMultipleFilesService };
