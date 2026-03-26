import { scanCommand } from "./commands/scan";

const command = process.argv[2];

async function main() {
  switch (command) {
    case "scan":
      await scanCommand();
      break;
    case "watch":
      console.log("⏳ watch 指令尚未實作（Phase 2）");
      break;
    case "generate":
      console.log("⏳ generate 指令尚未實作（Phase 2）");
      break;
    default:
      console.log("用法: npm run scan | watch | generate");
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("執行錯誤:", err);
  process.exit(1);
});
