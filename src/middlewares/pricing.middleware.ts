import { PackageStatus } from "../dtos/package.dto";
import { PurchaseStatus } from "../dtos/purchaserecords.dto";
import PurchaseRecordsModel from "../models/purchaserecords.model";
import { getMetaValue } from "../utils/meta.util";

const PricingMiddleware = (featureTitle: string) => {
  return async (req: any, res: any, next: any) => {
    try {
      const property = req.property;
      if (!property) {
        return res.status(404).json({ message: "Workspace not found." });
      }
      const activePackageId = getMetaValue(property.meta, "active_package");
      if (!activePackageId) {
        return res.status(404).json({ message: "No active package found." });
      }
      const activePackage = await PurchaseRecordsModel.findById(
        activePackageId
      );

      if (!activePackage) {
        return res
          .status(403)
          .json({ message: "No active package found for this property." });
      }

      switch (activePackage.status) {
        case PurchaseStatus.COMPLETED:
          break;
        case PurchaseStatus.PENDING:
        case PurchaseStatus.EXPIRED:
        default:
          return res.status(403).json({
            message: `Your current package is '${activePackage.status}'. Please renew or upgrade.`,
          });
      }

      const activatedFeatures =
        getMetaValue(activePackage.meta, "activated_features") || [];
      if (!Array.isArray(activatedFeatures) || activatedFeatures.length === 0) {
        return res.status(403).json({
          message:
            "This action is not allowed in your current plan. Please upgrade.",
        });
      }

      const feature = activatedFeatures.find(
        (f: any) =>
          f.title?.trim()?.toLowerCase() === featureTitle.toLowerCase()
      );

      if (!feature) {
        return res.status(403).json({
          message: `Your plan does not include '${featureTitle}'. Please upgrade.`,
        });
      }
      const { used = 0, limit = 0 } = feature;
      if (limit === 0) {
        return res.status(403).json({
          message: `'${featureTitle}' has a limit of 0 in your plan. Please upgrade.`,
        });
      }

      if (used >= limit) {
        return res.status(403).json({
          message: `Limit reached for '${featureTitle}'. You have used ${used}/${limit}.`,
        });
      }
      return next();
    } catch (error: any) {
      console.error("FeatureLimitMiddleware Error:", error);
      return res.status(500).json({
        message: "Internal server error while checking feature limits.",
        error: error.message,
      });
    }
  };
};


export default PricingMiddleware;