import { Badge } from "@/components/ui/Badge"
import { Check, ChevronDown, ChevronRight, Folder, Search, User } from "lucide-react"
import { useEffect, useId, useMemo, useState } from "react"
import type { OrganizationSettingsView } from "@/services/organizationSettingsService"
import { WecomOpenDataDepartment } from "@/components/wecom/WecomOpenDataDepartment"
import { WecomOpenDataName } from "@/components/wecom/WecomOpenDataName"

export type DirectoryDepartment = NonNullable<OrganizationSettingsView["departments"]>[number]
export type DirectoryMember = NonNullable<OrganizationSettingsView["members"]>[number]
export type DirectorySelectionItem = {
  type: "user" | "department"
  id: string
}

export type DirectoryTreeNode = {
  department: DirectoryDepartment
  children: DirectoryTreeNode[]
  memberIDs: string[]
}

export type OrganizationDirectoryTree = {
  treeRoots: DirectoryTreeNode[]
  ungroupedUsers: string[]
}

export type OrganizationDirectorySelectProps = {
  label: string
  placeholder: string
  searchPlaceholder: string
  corpId: string
  treeRoots: DirectoryTreeNode[]
  ungroupedUsers: string[]
  memberMap: Map<string, DirectoryMember>
  departmentMap: Map<number, DirectoryDepartment>
  selectedItems: DirectorySelectionItem[]
  onChange: (next: DirectorySelectionItem[]) => void
  disabled?: boolean
  emptyText: string
  allowedUserIDs?: string[]
  allowedDepartmentIDs?: number[]
}

export const selectionKey = (item: DirectorySelectionItem): string =>
  `${item.type}:${item.id.trim()}`

export const normalizeSelectionItems = (
  items: DirectorySelectionItem[],
): DirectorySelectionItem[] => {
  const seen = new Set<string>()
  const out: DirectorySelectionItem[] = []
  items.forEach((item) => {
    const type = item.type === "department" ? "department" : "user"
    const id = item.id.trim()
    if (!id) return
    const key = `${type}:${id}`
    if (seen.has(key)) return
    seen.add(key)
    out.push({ type, id })
  })
  return out
}

export function buildDirectoryMaps(view: OrganizationSettingsView | null) {
  const departmentMap = new Map<number, DirectoryDepartment>()
  ;(view?.departments || []).forEach((department) => {
    const departmentID = Number(department.department_id || 0)
    if (departmentID > 0) {
      departmentMap.set(departmentID, department)
    }
  })
  const memberMap = new Map<string, DirectoryMember>()
  ;(view?.members || []).forEach((member) => {
    const userID = (member.userid || "").trim()
    if (userID) memberMap.set(userID, member)
  })
  return { departmentMap, memberMap }
}

export function buildDirectoryTree(
  view: OrganizationSettingsView | null,
): OrganizationDirectoryTree {
  const orderedDepartments = [...(view?.departments || [])].sort((a, b) => {
    const aParent = Number(a.parent_id || 0)
    const bParent = Number(b.parent_id || 0)
    if (aParent !== bParent) return aParent - bParent
    const aOrder = Number(a.order || 0)
    const bOrder = Number(b.order || 0)
    if (aOrder !== bOrder) return aOrder - bOrder
    const aName = (a.name || "").trim()
    const bName = (b.name || "").trim()
    if (aName !== bName) return aName.localeCompare(bName, "zh-CN")
    return Number(a.department_id || 0) - Number(b.department_id || 0)
  })

  const departmentChildrenMap = new Map<number, DirectoryDepartment[]>()
  orderedDepartments.forEach((department) => {
    const parentID = Number(department.parent_id || 0)
    const bucket = departmentChildrenMap.get(parentID) || []
    bucket.push(department)
    departmentChildrenMap.set(parentID, bucket)
  })

  const departmentIDs = new Set(
    orderedDepartments
      .map((department) => Number(department.department_id || 0))
      .filter((departmentID) => departmentID > 0),
  )

  const rootDepartments = orderedDepartments.filter((department) => {
    const parentID = Number(department.parent_id || 0)
    return parentID <= 0 || !departmentIDs.has(parentID)
  })
  const rootDepartmentID = departmentIDs.has(1)
    ? 1
    : rootDepartments.length > 0
      ? Number(rootDepartments[0]?.department_id || 0)
      : 0

  const departmentMembersMap = new Map<number, string[]>()
  const ungroupedUsers: string[] = []
  ;(view?.members || []).forEach((member) => {
    const userID = (member.userid || "").trim()
    if (!userID) return
    const departmentIDsForMember = Array.from(
      new Set(
        (member.departments || [])
          .map((department) => Number(department.department_id || 0))
          .filter((departmentID) => departmentID > 0),
      ),
    )
    const targetDepartmentIDs =
      departmentIDsForMember.length > 0
        ? departmentIDsForMember
        : rootDepartmentID > 0
          ? [rootDepartmentID]
          : []

    if (targetDepartmentIDs.length === 0) {
      ungroupedUsers.push(userID)
      return
    }

    targetDepartmentIDs.forEach((departmentID) => {
      const bucket = departmentMembersMap.get(departmentID) || []
      if (!bucket.includes(userID)) bucket.push(userID)
      departmentMembersMap.set(departmentID, bucket)
    })
  })

  const walk = (parentID: number): DirectoryTreeNode[] =>
    (departmentChildrenMap.get(parentID) || []).map((department) => {
      const departmentID = Number(department.department_id || 0)
      return {
        department,
        children: walk(departmentID),
        memberIDs: [...(departmentMembersMap.get(departmentID) || [])].sort(
          (left, right) => left.localeCompare(right, "zh-CN"),
        ),
      }
    })

  const rootParentIDs = Array.from(
    new Set(rootDepartments.map((department) => Number(department.parent_id || 0))),
  ).sort((left, right) => left - right)

  return {
    treeRoots: rootParentIDs.flatMap((parentID) => walk(parentID)),
    ungroupedUsers: ungroupedUsers.sort((left, right) => left.localeCompare(right, "zh-CN")),
  }
}

export function buildScopedDirectoryTree(
  view: OrganizationSettingsView | null,
  allowedUserIDs?: string[],
  allowedDepartmentIDs?: number[],
): OrganizationDirectoryTree {
  const fullTree = buildDirectoryTree(view)
  const allowedUserSet =
    allowedUserIDs !== undefined
      ? new Set(allowedUserIDs.map((item) => item.trim()).filter(Boolean))
      : null
  const allowedDepartmentSet =
    allowedDepartmentIDs !== undefined
      ? new Set(
          allowedDepartmentIDs
            .map((item) => Number(item || 0))
            .filter((item) => Number.isInteger(item) && item > 0),
        )
      : null

  if (!allowedUserSet && !allowedDepartmentSet) {
    return fullTree
  }

  const walk = (node: DirectoryTreeNode): DirectoryTreeNode | null => {
    const departmentID = Number(node.department.department_id || 0)
    const filteredChildren = node.children
      .map(walk)
      .filter(Boolean) as DirectoryTreeNode[]
    const filteredMembers = node.memberIDs.filter((userID) =>
      allowedUserSet ? allowedUserSet.has(userID) : true,
    )
    const departmentAllowed = allowedDepartmentSet
      ? allowedDepartmentSet.has(departmentID)
      : false
    if (!departmentAllowed && filteredChildren.length === 0 && filteredMembers.length === 0) {
      return null
    }
    return {
      department: node.department,
      children: filteredChildren,
      memberIDs: filteredMembers,
    }
  }

  return {
    treeRoots: fullTree.treeRoots.map(walk).filter(Boolean) as DirectoryTreeNode[],
    ungroupedUsers: fullTree.ungroupedUsers.filter((userID) =>
      allowedUserSet ? allowedUserSet.has(userID) : true,
    ),
  }
}

export function buildSelectedObjectDirectoryTree(
  view: OrganizationSettingsView | null,
  selectedUserIDs?: string[],
  selectedDepartmentIDs?: number[],
): OrganizationDirectoryTree {
  const fullTree = buildDirectoryTree(view)
  const explicitUserSet = new Set(
    (selectedUserIDs || []).map((item) => item.trim()).filter(Boolean),
  )
  const explicitDepartmentSet = new Set(
    (selectedDepartmentIDs || [])
      .map((item) => Number(item || 0))
      .filter((item) => Number.isInteger(item) && item > 0),
  )

  if (explicitUserSet.size === 0 && explicitDepartmentSet.size === 0) {
    return { treeRoots: [], ungroupedUsers: [] }
  }

  const matchedUserSet = new Set<string>()
  const walk = (node: DirectoryTreeNode): DirectoryTreeNode | null => {
    const departmentID = Number(node.department.department_id || 0)
    const filteredChildren = node.children
      .map(walk)
      .filter(Boolean) as DirectoryTreeNode[]
    const filteredMembers = node.memberIDs.filter((userID) => {
      const matched = explicitUserSet.has(userID)
      if (matched) matchedUserSet.add(userID)
      return matched
    })
    const explicitDepartment = explicitDepartmentSet.has(departmentID)
    if (!explicitDepartment && filteredChildren.length === 0 && filteredMembers.length === 0) {
      return null
    }
    return {
      department: node.department,
      children: filteredChildren,
      memberIDs: filteredMembers,
    }
  }

  const treeRoots = fullTree.treeRoots.map(walk).filter(Boolean) as DirectoryTreeNode[]
  const fallbackUngroupedUsers = Array.from(explicitUserSet).filter(
    (userID) => !matchedUserSet.has(userID),
  )

  return {
    treeRoots,
    ungroupedUsers: normalizeSelectionItems([
      ...fullTree.ungroupedUsers
        .filter((userID) => explicitUserSet.has(userID))
        .map((userID) => ({ type: "user" as const, id: userID })),
      ...fallbackUngroupedUsers.map((userID) => ({ type: "user" as const, id: userID })),
    ]).map((item) => item.id),
  }
}

const collectDepartmentIDs = (nodes: DirectoryTreeNode[]): number[] => {
  const ids: number[] = []
  const walk = (node: DirectoryTreeNode) => {
    const departmentID = Number(node.department.department_id || 0)
    if (departmentID > 0) ids.push(departmentID)
    node.children.forEach(walk)
  }
  nodes.forEach(walk)
  return ids
}

export function OrganizationDirectorySelect({
  label,
  placeholder,
  searchPlaceholder,
  corpId,
  treeRoots,
  ungroupedUsers,
  memberMap,
  departmentMap,
  selectedItems,
  onChange,
  disabled = false,
  emptyText,
  allowedUserIDs,
  allowedDepartmentIDs,
}: OrganizationDirectorySelectProps) {
  const generatedID = useId()
  const fieldID = useMemo(
    () => `organization-directory-${generatedID.replace(/[^a-zA-Z0-9_-]/g, "")}`,
    [generatedID],
  )
  const searchInputID = `${fieldID}-search`
  const [query, setQuery] = useState("")
  const [expandedDepartments, setExpandedDepartments] = useState<Set<number>>(
    () => new Set(collectDepartmentIDs(treeRoots)),
  )

  useEffect(() => {
    setExpandedDepartments(new Set(collectDepartmentIDs(treeRoots)))
  }, [treeRoots])

  const selectedKeys = useMemo(
    () => new Set(selectedItems.map((item) => selectionKey(item))),
    [selectedItems],
  )
  const selectedUserSet = useMemo(
    () =>
      new Set(
        selectedItems
          .filter((item) => item.type === "user")
          .map((item) => item.id.trim())
          .filter(Boolean),
      ),
    [selectedItems],
  )
  const selectedDepartmentSet = useMemo(
    () =>
      new Set(
        selectedItems
          .filter((item) => item.type === "department")
          .map((item) => Number(item.id || 0))
          .filter((item) => Number.isInteger(item) && item > 0),
      ),
    [selectedItems],
  )

  const allowedUserSet = useMemo(
    () =>
      allowedUserIDs !== undefined
        ? new Set(allowedUserIDs.map((item) => item.trim()).filter(Boolean))
        : null,
    [allowedUserIDs],
  )

  const allowedDepartmentSet = useMemo(
    () =>
      allowedDepartmentIDs !== undefined
        ? new Set(
            allowedDepartmentIDs
              .map((item) => Number(item || 0))
              .filter((item) => Number.isInteger(item) && item > 0),
          )
        : null,
    [allowedDepartmentIDs],
  )

  const keyword = query.trim().toLowerCase()

  const toggleSelection = (item: DirectorySelectionItem) => {
    if (disabled) return
    if (item.type === "user" && allowedUserSet && !allowedUserSet.has(item.id.trim())) return
    if (
      item.type === "department" &&
      allowedDepartmentSet &&
      !allowedDepartmentSet.has(Number(item.id || 0))
    )
      return
    const key = selectionKey(item)
    if (selectedKeys.has(key)) {
      onChange(selectedItems.filter((current) => selectionKey(current) !== key))
      return
    }
    onChange(normalizeSelectionItems([...selectedItems, item]))
  }

  const toggleExpanded = (departmentID: number) => {
    setExpandedDepartments((prev) => {
      const next = new Set(prev)
      if (next.has(departmentID)) next.delete(departmentID)
      else next.add(departmentID)
      return next
    })
  }

  const matchesMember = (userID: string): boolean => {
    if (allowedUserSet && !allowedUserSet.has(userID)) return false
    if (!keyword) return true
    const member = memberMap.get(userID)
    const role = (member?.role || "").trim()
    const adminText = member?.is_app_admin ? "企微应用管理员" : ""
    return `${userID} ${role} ${adminText}`.trim().toLowerCase().includes(keyword)
  }

  const matchesDepartment = (department: DirectoryDepartment): boolean => {
    const departmentID = Number(department.department_id || 0)
    if (allowedDepartmentSet && !allowedDepartmentSet.has(departmentID)) return false
    if (!keyword) return true
    const name = (department.name || "").trim()
    return `${departmentID} ${name}`.trim().toLowerCase().includes(keyword)
  }

  const filterTree = (nodes: DirectoryTreeNode[]): DirectoryTreeNode[] => {
    if (!keyword) return nodes
    const walk = (node: DirectoryTreeNode): DirectoryTreeNode | null => {
      const filteredChildren = node.children
        .map(walk)
        .filter(Boolean) as DirectoryTreeNode[]
      const filteredMembers = node.memberIDs.filter(matchesMember)
      if (
        matchesDepartment(node.department) ||
        filteredChildren.length > 0 ||
        filteredMembers.length > 0
      ) {
        return {
          department: node.department,
          children: filteredChildren,
          memberIDs: filteredMembers,
        }
      }
      return null
    }
    return nodes.map(walk).filter(Boolean) as DirectoryTreeNode[]
  }

  const filteredRoots = filterTree(treeRoots)
  const filteredUngroupedUsers = ungroupedUsers.filter(matchesMember)
  const hasContent = filteredRoots.length > 0 || filteredUngroupedUsers.length > 0

  const coveredUserSet = useMemo(() => {
    if (selectedDepartmentSet.size === 0) {
      return new Set<string>()
    }
    const covered = new Set<string>()
    const walk = (node: DirectoryTreeNode, parentCovered: boolean) => {
      const departmentID = Number(node.department.department_id || 0)
      const departmentCovered = parentCovered || selectedDepartmentSet.has(departmentID)
      if (departmentCovered) {
        node.memberIDs.forEach((userID) => {
          const normalized = userID.trim()
          if (normalized && !selectedUserSet.has(normalized)) {
            covered.add(normalized)
          }
        })
      }
      node.children.forEach((child) => walk(child, departmentCovered))
    }
    treeRoots.forEach((node) => walk(node, false))
    return covered
  }, [selectedDepartmentSet, selectedUserSet, treeRoots])

  const renderSelectionFlag = (state: "selected" | "covered" | null) =>
    state === "selected" ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
        <Check className="h-3 w-3" />
        已选
      </span>
    ) : state === "covered" ? (
      <span className="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700">
        部门覆盖
      </span>
    ) : null

  const getDepartmentDisabledHint = (selectable: boolean) =>
    selectable ? "" : "仅用于组织路径展示，不属于当前接待池对象"

  const renderMember = (userID: string, depth: number) => {
    const member = memberMap.get(userID)
    const role = (member?.role || "").trim() || "成员"
    const adminText = member?.is_app_admin ? "企微应用管理员" : ""
    const checked = selectedKeys.has(`user:${userID}`)
    const covered = !checked && coveredUserSet.has(userID)
    const selectable = !allowedUserSet || allowedUserSet.has(userID)
    return (
      <button
        type="button"
        key={`user-${userID}-${depth}`}
        onClick={() => toggleSelection({ type: "user", id: userID })}
        disabled={disabled || !selectable}
        className={`flex w-full items-start gap-3 rounded-lg px-2 py-1.5 text-left transition-colors ${
          checked
            ? "bg-blue-50"
            : covered
              ? "bg-sky-50"
              : selectable
                ? "hover:bg-gray-50"
                : "bg-transparent"
        } disabled:cursor-not-allowed disabled:opacity-60`}
        style={{ paddingLeft: `${14 + depth * 18}px` }}
      >
        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded ${
          checked
            ? "bg-blue-100 text-blue-700"
            : covered
              ? "bg-sky-100 text-sky-700"
              : "bg-gray-100 text-gray-500"
        }`}>
          <User className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 flex-1 space-y-0.5">
          <span className="flex items-center gap-2 min-w-0">
            <WecomOpenDataName
              userid={userID}
              corpId={corpId}
              fallback={userID}
              className={`truncate text-xs font-medium ${
                checked ? "text-blue-900" : covered ? "text-sky-900" : "text-gray-900"
              }`}
              hintClassName="text-[10px] text-gray-400"
            />
            {renderSelectionFlag(checked ? "selected" : covered ? "covered" : null)}
          </span>
          <span className="truncate text-[10px] text-gray-500">
            {role}
            {adminText ? ` · ${adminText}` : ""}
            {userID ? ` · ${userID}` : ""}
          </span>
        </span>
      </button>
    )
  }

  const renderDepartment = (node: DirectoryTreeNode, depth = 0) => {
    const departmentID = Number(node.department.department_id || 0)
    const checked = selectedKeys.has(`department:${departmentID}`)
    const expanded = expandedDepartments.has(departmentID) || Boolean(keyword)
    const selectable =
      !allowedDepartmentSet || allowedDepartmentSet.has(departmentID)
    const pathOnly = !selectable
    const fallbackName =
      (departmentMap.get(departmentID)?.name || "").trim() || `部门 #${departmentID}`
    const disabledHint = getDepartmentDisabledHint(selectable)
    return (
      <div key={`department-${departmentID}`} className="space-y-1">
        <div
          className={`flex items-start gap-2 rounded-lg px-2 py-1.5 transition-colors ${
            checked ? "bg-blue-50" : pathOnly ? "bg-gray-50" : "hover:bg-gray-50"
          }`}
          style={{ paddingLeft: `${6 + depth * 18}px` }}
          title={disabledHint}
        >
          <button
            type="button"
            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            onClick={() => toggleExpanded(departmentID)}
            disabled={disabled}
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            className={`flex min-w-0 flex-1 items-start gap-3 text-left ${
              selectable ? "" : "cursor-default"
            } disabled:cursor-not-allowed`}
            onClick={() =>
              toggleSelection({ type: "department", id: String(departmentID) })
            }
            disabled={disabled || !selectable}
          >
            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded ${
              checked
                ? "bg-blue-100 text-blue-700"
                : selectable
                  ? "bg-blue-50 text-blue-600"
                  : "bg-gray-100 text-gray-400"
            }`}>
              <Folder className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 flex-1 space-y-0.5">
              <span className="flex items-center gap-2 min-w-0">
                <WecomOpenDataDepartment
                  departmentId={departmentID}
                  corpId={corpId}
                  fallback={fallbackName}
                  className={`truncate text-xs font-semibold ${
                    checked
                      ? "text-blue-900"
                      : selectable
                        ? "text-gray-900"
                        : "text-gray-500"
                  }`}
                  hintClassName={`text-[10px] ${selectable ? "text-gray-400" : "text-gray-300"}`}
                />
                {renderSelectionFlag(checked ? "selected" : null)}
                {!selectable ? (
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                    不可选
                  </span>
                ) : null}
              </span>
              <span className="truncate text-[10px] text-gray-500">
                {selectable ? `部门 #${departmentID}` : disabledHint}
              </span>
            </span>
          </button>
        </div>
        {expanded ? (
          <div className="ml-5 space-y-1 border-l border-gray-100 pl-2">
            {node.memberIDs.map((userID) => renderMember(userID, depth + 1))}
            {node.children.map((child) => renderDepartment(child, depth + 1))}
          </div>
        ) : null}
      </div>
    )
  }

  const selectedDepartmentIDs = selectedItems
    .filter((item) => item.type === "department")
    .map((item) => Number(item.id))
    .filter((item) => Number.isInteger(item) && item > 0)
  const selectedUserIDs = selectedItems
    .filter((item) => item.type === "user")
    .map((item) => item.id.trim())
    .filter(Boolean)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label
          htmlFor={searchInputID}
          className="text-[11px] font-medium text-gray-700"
        >
          {label}
        </label>
        <div className="flex items-center gap-2 text-[11px] text-gray-500">
          <span>{selectedItems.length > 0 ? `已选 ${selectedItems.length} 项` : placeholder}</span>
          {selectedItems.length > 0 ? (
            <button
              type="button"
              className="text-blue-600 hover:text-blue-700"
              onClick={() => onChange([])}
              disabled={disabled}
            >
              清空
            </button>
          ) : null}
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-3 py-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              id={searchInputID}
              name={`${fieldID}_search`}
              aria-label={label}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              disabled={disabled}
              className="h-9 w-full rounded-md border border-gray-200 bg-white pl-9 pr-3 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-0 lg:grid-cols-[minmax(0,2.25fr)_minmax(320px,1fr)]">
          <div className="min-h-[24rem] max-h-[32rem] overflow-y-auto bg-white p-3.5">
            {hasContent ? (
              <div className="space-y-1">
                {filteredRoots.map((node) => renderDepartment(node, 0))}
                {filteredUngroupedUsers.length > 0 ? (
                  <div className="space-y-1 pt-3">
                    <div className="px-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                      公司直属成员
                    </div>
                    <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-2 py-2">
                      {filteredUngroupedUsers.map((userID) => renderMember(userID, 0))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="px-2 py-10 text-center text-xs text-gray-400">
                {emptyText}
              </div>
            )}
          </div>
          <div className="border-t border-gray-100 bg-gray-50 p-3.5 lg:max-h-[32rem] lg:overflow-y-auto lg:border-l lg:border-t-0">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold text-gray-700">已选择的成员或部门</div>
                <div className="text-[10px] text-gray-500">点击右侧移除</div>
              </div>
              <Badge variant="secondary" className="bg-white text-gray-700">
                {selectedItems.length} 项
              </Badge>
            </div>
            {selectedItems.length > 0 ? (
              <div className="space-y-2">
                {selectedDepartmentIDs.map((departmentID) => (
                  <div
                    key={`selected-department-${departmentID}`}
                    className="rounded-lg border border-blue-100 bg-white px-3 py-2 text-xs text-blue-800"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2 truncate font-medium">
                        <Folder className="h-3.5 w-3.5 shrink-0 text-blue-600" />
                        <WecomOpenDataDepartment
                          departmentId={departmentID}
                          corpId={corpId}
                          fallback={
                            (departmentMap.get(departmentID)?.name || "").trim() ||
                            `部门 #${departmentID}`
                          }
                          className="truncate text-xs font-medium text-blue-800"
                          hintClassName="text-[10px] text-blue-400"
                        />
                      </span>
                      <button
                        type="button"
                        className="text-[11px] text-blue-500 hover:text-blue-700"
                        onClick={() =>
                          toggleSelection({
                            type: "department",
                            id: String(departmentID),
                          })
                        }
                      >
                        移除
                      </button>
                    </div>
                    <div className="mt-0.5 text-[10px] text-blue-600">部门</div>
                  </div>
                ))}
                {selectedUserIDs.map((userID) => (
                  <div
                    key={`selected-user-${userID}`}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2 truncate">
                        <User className="h-3.5 w-3.5 shrink-0 text-gray-500" />
                        <WecomOpenDataName
                          userid={userID}
                          corpId={corpId}
                          fallback={userID}
                          className="min-w-0 flex-1 truncate text-xs font-medium text-gray-800"
                          hintClassName="text-[10px] text-gray-400"
                        />
                      </span>
                      <button
                        type="button"
                        className="text-[11px] text-gray-500 hover:text-gray-700"
                        onClick={() => toggleSelection({ type: "user", id: userID })}
                      >
                        移除
                      </button>
                    </div>
                    <div className="mt-0.5 text-[10px] text-gray-500">成员</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-200 bg-white px-3 py-8 text-center text-[11px] text-gray-400">
                暂无已选成员或部门
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
