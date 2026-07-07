require('dotenv').config(); // Load .env explicitly for this test script
const { LLMService } = require('./src/services/llm.service');

async function run() {
  console.log("Triggering LLMService.generateExplanation()...");
  const result = await LLMService.generateExplanation({
    transaction_id: "test-id",
    triggered_rules: [{ rule_name: "test-rule" }]
  });
  console.log("\n--- Returned Result ---");
  console.log(result);
}

run().catch(console.error);
