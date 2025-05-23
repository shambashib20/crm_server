import { LogStatus } from "../dtos/property.dto";
import Property from "../models/property.model";

const logPermissionDenied = async (
  user: any,
  property_id: string | undefined,
  reason: string,
  requiredPermission: string
) => {
  if (!property_id) return;

  try {
    await Property.findByIdAndUpdate(property_id, {
      $push: {
        logs: {
          title: "Permission Denied",
          description: `User '${
            user?.name || "Unknown"
          }' was denied access to '${requiredPermission}' because: ${reason}`,
          status: LogStatus.ERROR,
          meta: {
            userId: user?._id,
            role: user?.role?.name,
            requiredPermission,
            reason,
          },
        },
      },
    });
  } catch (err: any) {
    console.error("Failed to log permission denial:", err.message);
  }
};

export default logPermissionDenied;
