interface FileDto {
  file_url: string;
  file_id: string;
  name?: string;
  type?: string;
  uploaded_by?: string;
  status: "pending" | "completed" | "failed";
  meta?: Record<string, any>;
}




export {
    FileDto
}