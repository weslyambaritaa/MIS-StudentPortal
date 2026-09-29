import { Account } from "../../database/models/account.model";
import { SalesAccountAssignment } from "../../database/models/sales-account-assignment.model";

/**
 * Returns only Accounts with an active assignment to this Sales subject.
 * Filtering is performed by SQL through the required association join.
 */
export function findAccountsInSalesScope(salesSubject: string) {
  if (!salesSubject.trim()) {
    throw new Error("A Keycloak subject is required to resolve Sales account scope");
  }

  return Account.findAll({
    include: [
      {
        model: SalesAccountAssignment,
        as: "salesAssignments",
        attributes: [],
        required: true,
        where: { sales_subject: salesSubject, ended_at: null },
      },
    ],
    order: [["name", "ASC"]],
  });
}
