/**
 * src/repositories/customers.test.ts
 */

import { addCustomer, addCustomersBatch, getAllCustomers } from "./customers";

describe("customers repository", () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 }),
      getAllAsync: jest.fn().mockResolvedValue([]),
      withTransactionAsync: jest.fn(async (cb: () => Promise<void>) => {
        await cb();
      }),
    };
  });

  describe("addCustomer", () => {
    it("inserts a single customer into database", async () => {
      const id = await addCustomer(mockDb, {
        name: "Juma Hassan",
        phone: "0712345678",
      });

      expect(id).toBe(1);
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO customers"),
        ["Juma Hassan", "0712345678", expect.any(String)]
      );
    });
  });

  describe("addCustomersBatch", () => {
    it("returns 0 if newCustomers array is empty", async () => {
      const count = await addCustomersBatch(mockDb, []);
      expect(count).toBe(0);
      expect(mockDb.withTransactionAsync).not.toHaveBeenCalled();
    });

    it("inserts multiple customers in a single transaction", async () => {
      const contacts = [
        { name: "Kamau Wanjiku", phone: "0722000111" },
        { name: "Amina Mohamed", phone: "0733000222" },
        { name: "  ", phone: "0799999999" }, // Blank name should be skipped
      ];

      const count = await addCustomersBatch(mockDb, contacts);

      expect(count).toBe(2);
      expect(mockDb.withTransactionAsync).toHaveBeenCalledTimes(1);
      expect(mockDb.runAsync).toHaveBeenCalledTimes(2);
      expect(mockDb.runAsync).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("INSERT INTO customers"),
        ["Kamau Wanjiku", "0722000111", expect.any(String)]
      );
      expect(mockDb.runAsync).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("INSERT INTO customers"),
        ["Amina Mohamed", "0733000222", expect.any(String)]
      );
    });
  });

  describe("getAllCustomers", () => {
    it("fetches non-deleted customers sorted by name", async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([
        { id: 1, name: "Amina", phone: "0711111111", createdAt: "2026-01-01T00:00:00.000Z" },
      ]);

      const result = await getAllCustomers(mockDb);

      expect(result).toHaveLength(1);
      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining("WHERE isDeleted = 0")
      );
    });
  });
});
