const { Uri, workspace, window, commands } = require("vscode");
const { TextDecoder, TextEncoder } = require("util");
const { isEqual } = require("lodash");
const json5 = require("json5");
const merge = require("deepmerge");
const path = require("path");

const writeToFile = async (data, targetUri) => {
    const path = targetUri.path;
    try {
        await workspace.fs.writeFile(targetUri, data);
        console.log(`Successfully wrote to file ${path}!`);
    } catch (e) {
        window.showErrorMessage(`Unable to write contents to file: ${path}`);
    }
};

const createFileFromScratch = async (data, targetPath) => {
    console.log(`${targetPath} does not exists, creating one...`);
    const resolvedPath = path.resolve(
        workspace.workspaceFolders[0].uri.path,
        targetPath
    );

    const baseConfigAsString = JSON.stringify(data, null, 2);
    const encodedBaseConfig = new TextEncoder().encode(baseConfigAsString);

    return writeToFile(encodedBaseConfig, Uri.file(resolvedPath));
};

const appendToExistingFile = async (dataObject, targetUri, arrayMergeMode) => {
    console.log(`${targetUri.path} exists, appending needed info.`);

    const existingFileContent = await workspace.fs.readFile(targetUri);
    const existingDecodedConfig = json5.parse(
        new TextDecoder().decode(existingFileContent)
    );

    const newConfig = merge(existingDecodedConfig, dataObject, {
        arrayMerge: arrayMergeMode,
    });

    if (isEqual(existingDecodedConfig, newConfig)) {
        console.log(
            `Generated configs are equal to existing ones for file: ${targetUri.path}. No work to do.`
        );
        return;
    }

    return writeToFile(
        new TextEncoder().encode(JSON.stringify(newConfig, null, 2)),
        targetUri
    );
};

// Workaround to reload only the extension.
const reloadExtension = () =>
    commands.executeCommand("_meteorToolbox.reloadExtension");

const toggleAutoRunPackagesWatcher = async () => {
    const configuration = workspace.getConfiguration();

    const { auto, ...currentValue } = configuration.get(
        "conf.settingsEditor.meteorToolbox"
    );

    const newValue = { ...currentValue, ...{ auto: !!!auto } };

    await configuration.update("conf.settingsEditor.meteorToolbox", newValue);
    await reloadExtension();
};

const clearMeteorBuildCache = async () => {
    const workspaceRoot = workspace.workspaceFolders[0].uri;
    const localMeteorPath = [".meteor", "local"];

    const webBuildPath = Uri.joinPath(
        workspaceRoot,
        ...localMeteorPath,
        "build"
    );
    const cordovaBuildPath = Uri.joinPath(
        workspaceRoot,
        ...localMeteorPath,
        "cordova-build"
    );

    await Promise.all(
        [webBuildPath, cordovaBuildPath].map(async (dir) => {
            try {
                const folderExists = await workspace.fs.stat(dir);
                if (!folderExists) return;

                console.log(`Removing ${dir}...`);
                await workspace.fs.delete(dir, { recursive: true });
            } catch (e) {
                // Don' throw errors from stat(), it means the path does not exists.
                console.error(e);
            }
        })
    );

    window.showInformationMessage("Successfully cleared meteor build cache.");
};

const isWindows = () => process.platform === "win32";

module.exports = {
    createFileFromScratch,
    appendToExistingFile,
    toggleAutoRunPackagesWatcher,
    isWindows,
    clearMeteorBuildCache,
};
