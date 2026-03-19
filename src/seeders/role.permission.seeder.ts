import Permission, { PermissionDocument } from "../models/permission.model";
import Role from "../models/role.model";

export async function seedRolesAndPermissions() {
  const defaultPermissions = [
    { name: "manage_leads", description: "Manage all leads" },
    { name: "view_leads", description: "View leads" },
    { name: "call_leads", description: "Call leads" },
    { name: "manage_staff", description: "Manage staff members" },
    { name: "view_reports", description: "View reports and analytics" },
    {
      name: "manage_campaigns",
      description: "Create and manage marketing campaigns",
    },
    { name: "assign_leads", description: "Assign leads to agents or managers" },
    { name: "chat_with_leads", description: "Chat with potential leads" },
    { name: "manage_roles", description: "Create and manage user roles" },
    {
      name: "view_dashboard",
      description: "Access dashboard and summary data",
    },
    {
      name: "manage_sources_list",
      description: "Managing Source list in the platform",
    },
    {
      name: "manage_user_permissions",
      description: "Managing user permissions in the platform",
    },
    {
      name: "convert_lead_to_customer",
      description: "Convert a lead into a customer",
    },
  ];

  const existingPermissions = await Permission.countDocuments();
  let createdPermissions: PermissionDocument[] = [];

  if (existingPermissions === 0) {
    createdPermissions = await Permission.insertMany(defaultPermissions);
  } else {
    createdPermissions = await Permission.find();
  }

  const permissionMap = Object.fromEntries(
    createdPermissions.map((p) => [p.name, p._id])
  );

  const roles = [
    {
      name: "Superadmin",
      description: "MR Group organisation owner",
      permissions: createdPermissions.map((p) => p._id),
    },
    {
      name: "Admin",
      description: "Any organisation's Administrator",
      permissions: [
        permissionMap["view_leads"],
        permissionMap["assign_leads"],
        permissionMap["manage_staff"],
        permissionMap["view_reports"],
        permissionMap["view_dashboard"],
        permissionMap["manage_campaigns"],
        permissionMap["manage_sources_list"],
      ],
    },
    {
      name: "Lead Manager",
      description: "Team lead managing staff and lead assignment",
      permissions: [
        permissionMap["view_leads"],
        permissionMap["assign_leads"],
        permissionMap["call_leads"],
        permissionMap["view_reports"],
        permissionMap["manage_staff"],
      ],
    },
    {
      name: "Telecaller",
      description: "Staff who interact directly with leads",
      permissions: [
        permissionMap["view_leads"],
        permissionMap["chat_with_leads"],
        permissionMap["call_leads"],
        permissionMap["assign_leads"],
        permissionMap["manage_leads"],
      ],
    },
  ];

  const existingRoles = await Role.countDocuments();
  if (existingRoles === 0) {
    await Role.insertMany(roles);
  } else {
    // Patch existing roles to include new permissions if missing
    const patches: { roleName: string; permissions: string[] }[] = [
      { roleName: "Telecaller", permissions: ["assign_leads", "manage_leads"] },
      { roleName: "Lead Manager", permissions: ["manage_staff"] },
    ];

    for (const patch of patches) {
      const role = await Role.findOne({ name: patch.roleName });
      if (!role) continue;

      const existingPermIds = role.permissions.map((p: any) => p.toString());
      const toAdd = patch.permissions
        .map((name) => permissionMap[name])
        .filter((id) => id && !existingPermIds.includes(id.toString()));

      if (toAdd.length > 0) {
        await Role.findByIdAndUpdate(role._id, {
          $addToSet: { permissions: { $each: toAdd } },
        });
        console.log(
          `✅ '${patch.roleName}' role patched with ${toAdd.length} new permission(s)`
        );
      }
    }
  }

  console.log("✅ Roles and Permissions Seeded Successfully");
}
