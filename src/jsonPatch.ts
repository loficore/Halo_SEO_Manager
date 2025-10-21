/**
 * @file jsonPatch.ts
 * @description JSON Patch 操作工具模块，用于处理 Halo Content API 的 JSON Patch 操作
 */

import 'fast-json-patch';
import { applyPatch, compare, Operation, validate } from 'fast-json-patch';

/**
 * @function dataDiff
 * @description 返回将 oldData 转换为 newData 所需的 JSON Patch 操作
 * @param {object} oldData - 原始数据对象
 * @param {object} newData - 新数据对象
 * @returns {Operation[]} JSON Patch 操作数组
 */
const dataDiff = (oldData: object, newData: object): Operation[] => {
  return compare(oldData, newData);
};

/**
 * @function applyDataPatch
 * @description 将 JSON Patch 操作应用到给定的数据对象
 * @param {object} data - 要应用补丁的数据对象
 * @param {Operation[]} patch - JSON Patch 操作数组
 * @returns {object} 应用补丁后的新文档
 */
const applyDataPatch = (data: object, patch: Operation[]): object => {
  const result = applyPatch(
    data,
    patch,
    /*validate*/ true,
    /*mutateDocument*/ false,
  );
  return result.newDocument;
};

/**
 * @function validatePatch
 * @description 验证 JSON Patch 操作是否有效
 * @param {Operation[]} patch - JSON Patch 操作数组
 * @returns {boolean} 如果有效返回 true，否则返回 false
 */
const validatePatch = (patch: Operation[]): boolean => {
  try {
    const error = validate(patch);
    return error === null || error === undefined; //如果有效，validate返回null或undefined
  } catch {
    return false;
  }
};

export { dataDiff, applyDataPatch, validatePatch, Operation };
