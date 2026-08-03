import type { DirectoryData, DirectoryPermissions } from "@/types/user-directory";

export function getDirectoryData(_perms: DirectoryPermissions): DirectoryData {
  return {
    users: [],
    counts: { all: 0, active: 0, inactive: 0, staff: 0, students: 0 },
    roleOptions: [],
    departmentOptions: [],
  };
}
