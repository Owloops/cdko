/**
 * Logger utility with colored output using chalk from zx
 * Provides consistent logging across the application
 */

import { chalk } from 'zx';

export const logger = {
  error: (msg) => console.error(chalk.red('×'), msg),
  warn: (msg) => console.log(chalk.yellow('!'), msg),
  info: (msg) => console.log(chalk.blue('•'), msg),
  success: (msg) => console.log(chalk.green('✓'), msg),
  
  region: (region) => chalk.cyan(region),
  stack: (stackName) => chalk.bold(stackName),
  dim: (text) => chalk.dim(text),
};

export default logger;