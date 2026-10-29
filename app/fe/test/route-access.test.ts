import assert from "node:assert/strict";
import test from "node:test";

import { BUSINESS_ROLES, ROLES } from "@mis/shared-types";
import { MIS_PORTAL_ROLES, type MisPortalRole } from "../src/config/portal-roles";

import { FEATURE_ACCESS_MATRIX, navigationByRole } from "../src/config/navigation";
import {
  canActiveRoleAccessRoute,
  isRegisteredFrontendRoute,
  routeMatches,
} from "../src/lib/routing/route-access";

test("every MIS portal role can access its dashboard route", () => {
  for (const role of MIS_PORTAL_ROLES) {
    assert.equal(canActiveRoleAccessRoute("/dashboard", role), true);
  }
});

test("the development-only component showcase is not a registered application route", () => {
  for (const role of MIS_PORTAL_ROLES) {
    assert.equal(canActiveRoleAccessRoute("/components-preview", role), false);
  }
  assert.equal(isRegisteredFrontendRoute("/components-preview"), false);
});

test("Sales Industry route is available only in the Sales active-role context", () => {
  assert.equal(canActiveRoleAccessRoute("/sales/industry", ROLES.SALES), true);
  assert.equal(canActiveRoleAccessRoute("/sales/industry", ROLES.ADMIN), false);
  assert.equal(isRegisteredFrontendRoute("/sales/industry"), true);
});

test("Sales Request and Registration Form routes are separate views", () => {
  for (const route of ["/sales/request-form", "/sales/registration-form"]) {
    assert.equal(canActiveRoleAccessRoute(route, ROLES.SALES), true);
    assert.equal(canActiveRoleAccessRoute(route, ROLES.ADMIN), false);
    assert.equal(isRegisteredFrontendRoute(route), true);
  }
  const registration = navigationByRole[ROLES.SALES].sections.flatMap((section) => section.items).find((entry) => entry.key === "registration-form");
  assert.equal(registration?.href, "/sales/registration-form");
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

test("Course Category route is available only in the Admin active-role context", () => {
  assert.equal(canActiveRoleAccessRoute("/admin/course-categories", ROLES.ADMIN), true);
  assert.equal(canActiveRoleAccessRoute("/admin/course-categories", ROLES.SALES), false);
  assert.equal(isRegisteredFrontendRoute("/admin/course-categories"), true);
  const item = navigationByRole[ROLES.ADMIN].sections.flatMap((section) => section.items).find((entry) => entry.key === "course-category");
  assert.equal(item?.href, "/admin/course-categories");
  assert.equal(item?.disabled, undefined);
});

test("Training Room route is available only in the Admin active-role context", () => {
  assert.equal(canActiveRoleAccessRoute("/admin/training-rooms", ROLES.ADMIN), true);
  assert.equal(canActiveRoleAccessRoute("/admin/training-rooms", ROLES.SALES), false);
  assert.equal(isRegisteredFrontendRoute("/admin/training-rooms"), true);
  const item = navigationByRole[ROLES.ADMIN].sections.flatMap((section) => section.items).find((entry) => entry.key === "training-room");
  assert.equal(item?.href, "/admin/training-rooms");
  assert.equal(item?.disabled, undefined);
});

test("Trainer master route is available only in the Admin active-role context", () => {
  assert.equal(canActiveRoleAccessRoute("/admin/trainers", ROLES.ADMIN), true);
  assert.equal(canActiveRoleAccessRoute("/admin/trainers", ROLES.TRAINER), false);
  assert.equal(isRegisteredFrontendRoute("/admin/trainers"), true);
  const item = navigationByRole[ROLES.ADMIN].sections.flatMap((section) => section.items).find((entry) => entry.key === "trainer");
  assert.equal(item?.href, "/admin/trainers");
  assert.equal(item?.disabled, undefined);
});

test("sidebar navigation provides routes for all department features", () => {
  for (const role of MIS_PORTAL_ROLES) {
    const navigation = navigationByRole[role];
    const menuItems = [
      navigation.dashboard,
      ...(navigation.dashboardSectionItems ?? []),
      ...navigation.sections.flatMap((section) => section.items),
    ];

    assert.equal(navigation.dashboard.href, "/dashboard");
    for (const item of menuItems) {
      assert.ok(item.href, `${role}: ${item.label} should have a valid route`);
    }
  }
});

test("role sidebars use the menus read from the supplied designs", () => {
  const menuLabels = (role: MisPortalRole) =>
    navigationByRole[role].sections.flatMap((section: { items: readonly { label: string }[] }) =>
      section.items.map((item) => item.label)
    );

  assert.deepEqual(menuLabels(ROLES.SALES), [
    "Quotation",
    "Request Form",
    "Registration Form",
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
    "Request Form Review",
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
  assert.equal(Object.hasOwn(navigationByRole, ROLES.STUDENT), false);
  assert.equal(Object.hasOwn(navigationByRole, ROLES.PIC), false);
});

test("nested routes match without accepting similar path prefixes", () => {
  assert.equal(routeMatches("/sales/accounts/123", "/sales/accounts"), true);
  assert.equal(routeMatches("/sales/accounts-old", "/sales/accounts"), false);
});

test("sidebar items are generated only for roles declared in the feature matrix", () => {
  for (const role of MIS_PORTAL_ROLES) {
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
