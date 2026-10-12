import assert from "node:assert/strict";
import test from "node:test";

import { BUSINESS_ROLES, ROLES } from "@mis/shared-types";

import { FEATURE_ACCESS_MATRIX, navigationByRole } from "../src/config/navigation";
import {
  canActiveRoleAccessRoute,
  isRegisteredFrontendRoute,
  routeMatches,
} from "../src/lib/routing/route-access";

test("every business role can access its configured dashboard route", () => {
  for (const role of BUSINESS_ROLES) {
    assert.equal(canActiveRoleAccessRoute("/dashboard", role), true);
  }
});

test("the component showcase is registered for each current role", () => {
  for (const role of BUSINESS_ROLES) {
    assert.equal(canActiveRoleAccessRoute("/components-preview", role), true);
  }
  assert.equal(isRegisteredFrontendRoute("/components-preview"), true);
});

test("Sales Industry route is available only in the Sales active-role context", () => {
  assert.equal(canActiveRoleAccessRoute("/sales/industry", ROLES.SALES), true);
  assert.equal(canActiveRoleAccessRoute("/sales/industry", ROLES.ADMIN), false);
  assert.equal(isRegisteredFrontendRoute("/sales/industry"), true);
});

test("Account management routes are available only under their intended active roles", () => {
  assert.equal(canActiveRoleAccessRoute("/sales/accounts", ROLES.SALES), true);
  assert.equal(canActiveRoleAccessRoute("/sales/accounts", ROLES.ADMIN), false);
  assert.equal(canActiveRoleAccessRoute("/admin/personal-account-links", ROLES.ADMIN), true);
  assert.equal(canActiveRoleAccessRoute("/admin/personal-account-links", ROLES.SALES), false);
});

test("Sales PIC management route is unavailable to other active roles", () => {
  assert.equal(canActiveRoleAccessRoute("/sales/person-in-charge", ROLES.SALES), true);
  assert.equal(canActiveRoleAccessRoute("/sales/person-in-charge", ROLES.ADMIN), false);
  assert.equal(isRegisteredFrontendRoute("/sales/person-in-charge"), true);
});

test("sidebar navigation lists future features without making them navigable", () => {
  for (const role of BUSINESS_ROLES) {
    const navigation = navigationByRole[role];
    const menuItems = [
      navigation.dashboard,
      ...(navigation.dashboardSectionItems ?? []),
      ...navigation.sections.flatMap((section) => section.items),
    ];

    assert.equal(navigation.dashboard.href, "/dashboard");
    for (const item of menuItems.filter((item) => !["dashboard", "audit-trail", "industry", "account", "person-in-charge", "personal-account-links"].includes(item.key))) {
      assert.equal(item.disabled, true, `${role}: ${item.label} should be disabled until its page exists`);
      assert.equal(item.href, undefined, `${role}: ${item.label} must not point to a fake route`);
    }
  }
});

test("role sidebars use the menus read from the supplied designs", () => {
  const menuLabels = (role: (typeof BUSINESS_ROLES)[number]) =>
    navigationByRole[role].sections.flatMap((section) => section.items.map((item) => item.label));

  assert.deepEqual(menuLabels(ROLES.SALES), [
    "Quotation",
    "Request Form",
    "Industry",
    "Account",
    "Person In Charge",
  ]);
  assert.deepEqual(menuLabels(ROLES.ADMIN), [
    "Student",
    "Course",
    "Course Category",
    "Trainer",
    "Training Room",
    "Booking Room",
    "Personal Account Students",
    "List Training",
    "Training Calendar",
    "Generate Certificate",
    "Manage Notifications",
    "Account & Credentials",
    "Audit Trail",
  ]);
  assert.deepEqual(
    [
      ...(navigationByRole[ROLES.FINANCE].dashboardSectionItems ?? []).map((item) => item.label),
      ...menuLabels(ROLES.FINANCE),
    ],
    ["Due Date", "Invoice List", "Private Invoice", "Public Invoice"],
  );
  assert.deepEqual(menuLabels(ROLES.TRAINER), [
    "My Class List",
    "Finished Class",
    "Monitor Class",
    "Trainer Calendar",
  ]);
  assert.deepEqual(menuLabels(ROLES.STUDENT), [
    "Attendance",
    "Evaluation Form",
    "Course History",
    "E-Learning",
    "Remote Lab",
    "My Profile",
    "Pre / Post Test",
    "Learning Path",
  ]);
  assert.deepEqual(menuLabels(ROLES.PIC), ["Training Account", "Training Report", "Skill Matrix"]);
});

test("nested routes match without accepting similar path prefixes", () => {
  assert.equal(routeMatches("/sales/accounts/123", "/sales/accounts"), true);
  assert.equal(routeMatches("/sales/accounts-old", "/sales/accounts"), false);
});

test("sidebar items are generated only for roles declared in the feature matrix", () => {
  for (const role of BUSINESS_ROLES) {
    const navigation = navigationByRole[role];
    const menuItems = [
      navigation.dashboard,
      ...(navigation.dashboardSectionItems ?? []),
      ...navigation.sections.flatMap((section) => section.items),
    ];

    for (const item of menuItems) {
      const matrixEntry = FEATURE_ACCESS_MATRIX.find((entry) => entry.key === item.key);
      assert.ok(matrixEntry, `${item.key} should have one registry entry`);
      assert.equal(matrixEntry.roles.includes(role), true, `${role} should be allowed ${item.key}`);
    }
  }
});

test("a Sales-only route is allowed for Sales and denied for another active role", () => {
  const salesOnlyRoute = "/sales/accounts";
  const testFeatureMatrix = [
    ...FEATURE_ACCESS_MATRIX,
    {
      key: "sales-accounts-test",
      label: "Sales Accounts",
      icon: "account" as const,
      roles: [ROLES.SALES],
      route: salesOnlyRoute,
    },
  ];

  assert.equal(canActiveRoleAccessRoute(salesOnlyRoute, ROLES.SALES, testFeatureMatrix), true);
  assert.equal(canActiveRoleAccessRoute(salesOnlyRoute, ROLES.MANAGEMENT, testFeatureMatrix), false);
  assert.equal(isRegisteredFrontendRoute(salesOnlyRoute, testFeatureMatrix), true);
});

test("no-access requires the absence of an active business role", () => {
  assert.equal(canActiveRoleAccessRoute("/no-access", null), true);
  assert.equal(canActiveRoleAccessRoute("/no-access", ROLES.STUDENT), false);
  assert.equal(canActiveRoleAccessRoute("/unknown", null), false);
  assert.equal(canActiveRoleAccessRoute("/unknown", ROLES.STUDENT), false);
  assert.equal(isRegisteredFrontendRoute("/unknown"), false);
});

test("Access Logs is a separate Keycloak-admin-only route, not an Admin QPD business feature", () => {
  assert.equal(isRegisteredFrontendRoute("/admin/access-logs"), true);
  assert.equal(canActiveRoleAccessRoute("/admin/access-logs", ROLES.ADMIN), false);
  assert.equal(canActiveRoleAccessRoute("/admin/access-logs", null, undefined, false), false);
  assert.equal(canActiveRoleAccessRoute("/admin/access-logs", null, undefined, true), true);
});

test("Audit Trail is a business Admin QPD route and respects activeRole", () => {
  assert.equal(isRegisteredFrontendRoute("/admin/audit-trail"), true);
  assert.equal(canActiveRoleAccessRoute("/admin/audit-trail", ROLES.ADMIN), true);
  assert.equal(canActiveRoleAccessRoute("/admin/audit-trail", ROLES.SALES), false);
  assert.equal(canActiveRoleAccessRoute("/admin/audit-trail", null), false);
});
