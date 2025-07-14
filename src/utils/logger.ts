import { chalk } from "zx";

export const logger = {
  error: (msg: string) => console.error(chalk.red("x"), msg),
  warn: (msg: string) => console.log(chalk.yellow("!"), msg),
  info: (msg: string) => console.log(chalk.blue("•"), msg),
  success: (msg: string) => console.log(chalk.green("✓"), msg),

  region: (region: string) => chalk.cyan(region),
  stack: (stackName: string) => chalk.bold(stackName),
  dim: (text: string) => chalk.dim(text),
};

export default logger;
