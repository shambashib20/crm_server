import { Schema, model } from "mongoose";
import { FileDto } from "../dtos/file.dto";

const FileSchema = new Schema<FileDto & Document>(
  {
    file_url: {
      type: String,
    },
    file_id: {
      type: String,
      default: "",
    },
    name: {
      type: String,
      default: "",
    },
    type: {
      type: String,
      default: "",
    },
    uploaded_by: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
    },
    meta: { type: Object },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const File = model<FileDto & Document>("File", FileSchema);
export default File;
