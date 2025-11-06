import path from 'path';
import os from 'os';

const terraformDir = process.env.TERRAFORM_DIR || os.homedir();
const absoluteTerraformDir = path.resolve(terraformDir);

export {
    terraformDir,
    absoluteTerraformDir,
}
