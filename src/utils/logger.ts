import { chalk } from "zx";

export const logger = {
  error: (msg: string) => console.error(chalk.red("✗"), msg),
  warn: (msg: string) => console.log(chalk.yellow("⚠"), msg),
  info: (msg: string) => console.log(chalk.blue("•"), msg),
  success: (msg: string) => console.log(chalk.green("✓"), msg),
  header: (msg: string) => console.log(chalk.bold.blue(msg)),
  subheader: (msg: string) => console.log(chalk.dim(msg)),
  phase: (phase: string, msg: string) =>
    console.log(chalk.bold(`${phase}:`), msg),
  dim: (text: string) => chalk.dim(text),
};
