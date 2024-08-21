// import fs, { readFileSync } from 'fs-extra';
import { toolkit } from '@docgeni/toolkit';
import path from 'path';
import _ from 'lodash';
// import { exec as pkgExec } from '@sunjingyun/pkg';
import { exec as pkgExec } from 'pkg';
import jsonfile from 'jsonfile';
import handlebars from 'handlebars';
import { mainTmpl } from './config/main.tmpl.js';
import rimraf from 'rimraf';
// import CopyPlugin from 'copy-webpack-plugin';
import { Handler } from '../handlers/base-handler.js';
import { getAbsolutePath } from '../utils.js';
import copy from 'copy';
import chalk from 'chalk';
import ora from 'ora';
import webpack from 'webpack';
import { webpackConfigSys } from './config/index.js';
export class PkgHandler extends Handler {
    constructor(options) {
        super(`clone`, options);
        // name = BuildType.pkg;
        this.context = {};
        this.context.options = options;
    }
    async run() {
        const spinner = ora('Verify command...').start();
        this.validateParams();
        spinner.succeed(`${chalk.green('Verify command')}`);
        spinner.start('Context init...');
        this.initContext();
        spinner.succeed(`${chalk.green('Context initialization')}`);
        spinner.start('Build pkg config...');
        await this.syncSourceData();
        await this.buildPkgConfig();
        spinner.succeed(`${chalk.green('Build pkg config completed')}`);
        if (!this.options.bypassVerify) {
            spinner.start('Inject verify entry code...');
            await this.injectMain();
            spinner.succeed(`${chalk.green('Inject verify entry code completed')}`);
        }
        if (this.context.isBundle) {
            spinner.start('Build code by webpack...');
            const webpackConfig = this.buildWebpackConfigDefault();
            await this.webpackBuild(webpackConfig);
            spinner.succeed(`${chalk.green('Build code by webpack completed')}`);
        }
        // await this.syncStaticFiles();
        // await this.moveFiles();
        spinner.start('Sync node_modules...');
        await this.syncNodeModules();
        spinner.succeed(`${chalk.green('Sync node_modules completed')}`);
        spinner.start('Pkb building...');
        await this.pkgBuild();
        spinner.succeed(`${chalk.green('Pkg build completed')}`);
        spinner.start('Sync *.node files...');
        await this.syncDoNodeFiles();
        if (!this.context.reserveTmpDir) {
            this.removeTmpFiles();
        }
        spinner.succeed(`${chalk.green('Sync *.node files completed')}`);
        spinner.succeed(`${chalk.green('Successfully')}`);
    }
    removeTmpFiles() {
        this.rmFiles(this.context.outputTmpPath);
    }
    initContext() {
        this.context.entryFileName = path.basename(this.options.entry);
        this.context.entryFilePath = getAbsolutePath(this.options.entry);
        this.context.rootPath = this.options.root ? getAbsolutePath(this.options.root) : path.dirname(this.context.entryFilePath);
        this.context.outputPath = getAbsolutePath(this.options.output);
        this.context.outputTmpPath = path.join(this.context.outputPath, '.tmp');
        this.context.outputTmpFileName = `${path.parse(this.context.entryFileName).name}`;
        this.context.injectStartFileName = `start${_.random(1000, 9999, false)}.js`;
        this.context.webpackStartFileName = `webpack-start${_.random(1000, 9999, false)}.js`;
        this.context.appVerifyPath = this.options.appVerifyPath ? this.options.appVerifyPath : undefined;
        this.context.target = this.options.target;
        this.context.scripts = this.options.scripts;
        this.context.nodeModulesPath = this.options.nodeModulesPath ? getAbsolutePath(this.options.nodeModulesPath) : null;
        this.context.assets = this.options.assets;
        this.context.name = `${this.options.name}-${this.options.target}`;
        this.context.reserveTmpDir = this.options.reserveTmpDir;
        this.context.bypassVerify = this.options.bypassVerify;
        this.context.isBundle = this.options.isBundle;
        this.context.doNodeFiles = this.options.doNodeFiles || [];
    }
    validateParams() {
        if (!this.options.entry) {
            throw new Error('entry ie required');
        }
        if (!this.options.name) {
            throw new Error('name ie required');
        }
        if (!this.options.output) {
            throw new Error('output ie required');
        }
        if (!this.options.target) {
            throw new Error('target ie required');
        }
    }
    // entryPath: `./${this.context.isBundle ? this.context.webpackStartFileName : this.context.outputTmpFileName}`
    buildWebpackConfigDefault() {
        const webpackConfigDefault = {
            entry: !this.context.bypassVerify
                ? path.join(this.context.outputTmpPath, this.context.injectStartFileName)
                : this.context.entryFilePath,
            plugins: [],
            output: {
                filename: this.context.webpackStartFileName,
                libraryTarget: 'umd',
                path: this.context.outputTmpPath,
            },
        };
        this.context.webpackConfig = _.merge(webpackConfigSys, webpackConfigDefault);
        return this.context.webpackConfig;
    }
    async webpackBuild(webpackConfig) {
        return new Promise((resolve, reject) => {
            const webpackBuilder = webpack(webpackConfig || this.context.webpackConfig);
            webpackBuilder.run((error, stats) => {
                if (error) {
                    return reject(error);
                }
                if (stats.compilation.errors.length > 0) {
                    console.log(stats.compilation.errors.map((error) => error.message));
                    return reject(stats.compilation.errors.map((error) => error.message));
                }
                return resolve(stats);
            });
        });
    }
    async syncDoNodeFiles() {
        if (this.context.doNodeFiles.length > 0) {
            await this.syncFiles(this.context.doNodeFiles.map((noNodeFile) => path.join(this.context.outputTmpPath, noNodeFile)), 
            // this.context.doNodeFiles.map(noNodeFile => path.join(process.cwd(), noNodeFile)),
            this.context.outputPath);
        }
    }
    async syncNodeModules() {
        await toolkit.fs.remove(path.join(this.context.outputTmpPath, 'node_modules'));
        toolkit.fs.copySync(this.context.nodeModulesPath ? this.context.nodeModulesPath : path.join(process.cwd(), 'node_modules'), path.join(this.context.outputTmpPath, 'node_modules'), {
            overwrite: true,
            errorOnExist: false,
        });
    }
    async syncSourceData() {
        toolkit.fs.copySync(this.context.rootPath, this.context.outputTmpPath, {
            overwrite: true,
            errorOnExist: false,
        });
    }
    async buildPkgConfig() {
        const pkgConfig = {
            pkg: {
                scripts: this.context.scripts,
                assets: [...this.context.assets, 'locales/**/**', 'templates/**/**', '*.map'],
            },
        };
        const pkgConfigJsonPath = path.join(this.context.outputTmpPath, '.pkg.config.json');
        this.context.pkgConfigJsonPath = pkgConfigJsonPath;
        jsonfile.writeFileSync(this.context.pkgConfigJsonPath, pkgConfig, { spaces: 2 });
        this.context = {
            ...this.context,
            ...pkgConfig.pkg,
        };
    }
    async pkgBuild() {
        const jsFiles = this.context.bypassVerify
            ? this.context.isBundle
                ? path.join(this.context.outputTmpPath, this.context.webpackStartFileName)
                : path.join(this.context.outputTmpPath, `${this.context.outputTmpFileName}.js`)
            : path.join(this.context.outputTmpPath, this.context.injectStartFileName);
        const paramsArr = [
            jsFiles,
            // path.join(this.context.outputPath, this.context.injectStartFileName),
            '--target',
            this.context.target,
            '--output',
            path.join(this.context.outputPath, this.context.name),
            '-c',
            path.join(this.context.outputTmpPath, '.pkg.config.json'),
        ];
        await pkgExec(paramsArr);
        return;
    }
    async injectMain() {
        let appVerifyPath;
        if (this.context.appVerifyPath) {
            appVerifyPath = _.difference(path.join(this.context.outputTmpPath, this.context.appVerifyPath).split('/'), this.context.outputTmpPath.split('/')).join('/');
            appVerifyPath = `./${path.basename(appVerifyPath, path.extname(appVerifyPath))}.js`;
        }
        const tmplData = {
            // debug: this.context.debug,
            appVerifyPath: appVerifyPath,
            entryPath: `./${this.context.outputTmpFileName}`,
        };
        const data = handlebars.compile(mainTmpl)(tmplData);
        toolkit.fs.writeFileSync(path.join(this.context.outputTmpPath, this.context.injectStartFileName), data);
    }
    async rmFiles(file) {
        return new Promise((resolve, reject) => {
            try {
                rimraf.sync(file);
                return resolve(true);
            }
            catch (error) {
                reject(error);
            }
        });
    }
    async syncFiles(files, targetDir) {
        for (const file of files) {
            await this.copyAsync(file, targetDir);
        }
    }
    async copyAsync(patterns, dir, options) {
        return new Promise((resolve, reject) => {
            copy.call(copy, patterns, dir, options, (error, files) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve(files);
                }
            });
        });
    }
}
//# sourceMappingURL=pkg-handler.js.map