//halo Content API only allow JSON Patch
import 'fast-json-patch';
import { applyPatch, compare, Operation, validate } from 'fast-json-patch';

// Function to return the JSON Patch operations needed to transform oldData into newData
const dataDiff = (oldData: Object, newData: Object): Operation[] => {
  return compare(oldData, newData);
};

// Function to apply a list of JSON Patch operations to a given data object
const applyDataPatch = (data: Object, patch: Operation[]): Object => {
  const result = applyPatch(
    data,
    patch,
    /*validate*/ true,
    /*mutateDocument*/ false,
  );
  return result.newDocument;
};

// Function to validate JSON Patch operations
// 如果有效，返回true；否则返回false
const validatePatch = (patch: Operation[]): boolean => {
  try {
    const error = validate(patch);
    return error === null || error === undefined; //如果有效，validate返回null或undefined
  } catch (error) {
    return false;
  }
};

export { dataDiff, applyDataPatch, validatePatch, Operation };
