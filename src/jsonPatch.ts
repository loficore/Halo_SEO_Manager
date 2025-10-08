import  "fast-json-patch";  
import { applyPatch, compare, Operation } from "fast-json-patch";

// Function to return the JSON Patch operations needed to transform oldData into newData
const dataDiff = (oldData : Object, newData : Object) : Operation[] => {
    return compare(oldData, newData);
};

// Function to apply a list of JSON Patch operations to a given data object
const applyDataPatch = (data : Object, patch : Operation[]) : Object => {
    const result = applyPatch(data, patch, /*validate*/ true, /*mutateDocument*/ false);
    return result.newDocument;
};

export { dataDiff, applyDataPatch };