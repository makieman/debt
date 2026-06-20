/**
 * App.tsx
 *
 * DAY 1 TEST HARNESS — This is NOT the real app UI.
 * It exists only to verify that:
 *   1. The database opens and migrations run successfully
 *   2. We can insert customers and transactions
 *   3. The balance calculation is correct (should be 300: 500 debt − 200 payment)
 *   4. Data persists across reloads (we only insert if the DB is empty)
 *
 * Delete or replace this file on Day 2 when we build real screens.
 */

import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';

// Import our database singleton and migration runner
import { db, runMigrations } from './src/db';

// Import repository functions — the test harness uses these exactly as
// real screens will, so this also validates the import paths.
import { addCustomer, getAllCustomers } from './src/repositories/customers';
import { addTransaction, getBalanceForCustomer } from './src/repositories/transactions';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TestResult {
  status: 'idle' | 'running' | 'success' | 'error';
  logs: string[];
  error?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function App() {
  const [result, setResult] = useState<TestResult>({
    status: 'idle',
    logs: [],
  });

  useEffect(() => {
    /**
     * runDatabaseTest() is an async function defined and immediately called
     * inside useEffect. We do it this way because useEffect's callback itself
     * cannot be async (React restriction) — so we create an inner async
     * function and call it immediately.
     */
    async function runDatabaseTest() {
      const logs: string[] = [];

      try {
        setResult({ status: 'running', logs: ['🔄 Running migrations...'] });

        // ── Step 1: Run migrations ──────────────────────────────────────────
        await runMigrations(db);
        logs.push('✅ Migrations complete');

        // ── Step 2: Seed data (only if database is empty) ──────────────────
        // This prevents duplicate "Kamau Wanjiku" entries on every reload.
        // Pattern: check before inserting — this is how you handle seed data.
        const existingCustomers = await getAllCustomers(db);

        if (existingCustomers.length === 0) {
          logs.push('📝 Database is empty — inserting test data...');

          // Insert test customer
          const customerId = await addCustomer(db, {
            name: 'Kamau Wanjiku',
            phone: '0712345678',
          });
          logs.push(`👤 Customer inserted with id: ${customerId}`);

          // Insert a debt transaction: Kamau owes 500 KES
          await addTransaction(db, {
            customerId,
            type: 'debt',
            amount: 500,
            note: 'Unga na sukari',
          });
          logs.push('📊 Debt of 500 KES recorded');

          // Insert a payment transaction: Kamau paid 200 KES
          await addTransaction(db, {
            customerId,
            type: 'payment',
            amount: 200,
            note: 'Cash payment',
          });
          logs.push('💰 Payment of 200 KES recorded');
        } else {
          logs.push(`ℹ️ Database already has ${existingCustomers.length} customer(s) — skipping seed`);
        }

        // ── Step 3: Fetch and display all customers ─────────────────────────
        const customers = await getAllCustomers(db);
        logs.push(`\n👥 All Customers (${customers.length} total):`);
        customers.forEach((c) => {
          logs.push(`   • ${c.name} — ${c.phone ?? 'no phone'} (id: ${c.id})`);
        });

        // ── Step 4: Fetch balance for first customer ─────────────────────────
        if (customers.length > 0) {
          const balance = await getBalanceForCustomer(db, customers[0].id);
          logs.push(`\n💳 Balance for "${customers[0].name}": KES ${balance}`);

          if (balance === 300) {
            logs.push('🎉 Balance is correct! (500 debt − 200 payment = 300)');
          } else {
            logs.push(`⚠️  Unexpected balance. Expected 300, got ${balance}`);
          }
        }

        setResult({ status: 'success', logs });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Database test failed:', error);
        setResult({
          status: 'error',
          logs,
          error: errorMessage,
        });
      }
    }

    runDatabaseTest();
  }, []); // Empty array = run once on mount, never again

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <Text style={styles.title}>🏪 Duka Deni</Text>
      <Text style={styles.subtitle}>Day 1 — Database Test Harness</Text>

      <View style={styles.statusBadge}>
        <Text style={styles.statusText}>
          {result.status === 'idle' && '⏳ Waiting...'}
          {result.status === 'running' && '🔄 Running...'}
          {result.status === 'success' && '✅ DB test complete — check console'}
          {result.status === 'error' && `❌ Error: ${result.error}`}
        </Text>
      </View>

      <ScrollView style={styles.logContainer} contentContainerStyle={styles.logContent}>
        {result.logs.map((log, index) => (
          <Text key={index} style={styles.logLine}>
            {log}
          </Text>
        ))}
      </ScrollView>

      <Text style={styles.footer}>
        Open Metro bundler console for full output
      </Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
// Minimal styles — Day 2 is when we add NativeWind and proper design.

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',   // Dark slate
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f1f5f9',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 24,
  },
  statusBadge: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#22c55e',
  },
  statusText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600',
  },
  logContainer: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 8,
  },
  logContent: {
    padding: 16,
  },
  logLine: {
    color: '#94a3b8',
    fontSize: 13,
    fontFamily: 'monospace',  // On Android/iOS monospace maps to a system font
    lineHeight: 22,
  },
  footer: {
    color: '#475569',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 16,
  },
});
