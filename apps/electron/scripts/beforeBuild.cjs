exports.default = async function beforeBuild() {
  console.log(
    '[electron-builder] node_modules handled by explicit bundles and extraResources; skipping automatic dependency collection',
  );
  return false;
};
