export interface WhatsAppDeviceDto {
  d_id: number;
  u_id: number;
  mobile_no: string;
  status: number;
  connectionId: string;
  old_connection_id: string;
  u_device_token: string;
  device_name: string;
  host_device: string;
  created_at: Date;
  updated_at: Date;
  is_meta_device: string;
  device_status: string;
}
