import { Path, Schema } from "swagger-schema-official";

export interface ICbEntity {
  // type: "object";
  title: string;
  description?: string;
  attributes: ICbAttribute[];
  isResource: boolean;
}

export interface ICbAttributeAllowableValues {
  // TODO all types
  valueType: "List" | "RegExp" | "Range";
  match?: string;
  values: any[];
  min: number;
  max: number;
}

export interface ICbAttribute {
  allowableValues?: ICbAttributeAllowableValues;
  defaultValue?: any;
  type: string;
  items?: string;
  minLength?: number;
  maxLength?: number;
  title: string;
  renderHint?: string;
  description?: string;
  isRequired?: boolean;
  isCore?: boolean;
}

export function parseAttribute(attribute: ICbAttribute): Schema {
  switch (attribute.type) {
    case "ObjectId":
      return {
        $ref: "#/definitions/ObjectId"
      };

    case "Array":
      return {
        type: "array",
        description: attribute.description,
        items: parseAttribute({
          type: attribute.items as string,
          title: ""
        })
      };

    case "Date":
      // CB datetime or date are always date-time
      return {
        type: "string",
        description: attribute.description,
        format: "date-time",
        default:
          attribute.defaultValue || attribute.defaultValue === 0
            ? attribute.defaultValue
            : undefined
      };

    case "int":
    case "float":
      return {
        type: attribute.type === "int" ? "integer" : "number",
        description: attribute.description,
        minimum:
          attribute.allowableValues &&
          attribute.allowableValues.valueType === "Range"
            ? attribute.allowableValues.min
            : undefined,
        maximum:
          attribute.allowableValues &&
          attribute.allowableValues.valueType === "Range"
            ? attribute.allowableValues.max
            : undefined,
        default:
          attribute.defaultValue || attribute.defaultValue === 0
            ? attribute.defaultValue
            : undefined
      };

    case "array":
    case "boolean":
    case "integer":
    // case "null": // this type breaks the spec
    case "number":
    case "object":
    case "string":
      return {
        type: attribute.type,
        description: attribute.description,
        enum:
          attribute.allowableValues &&
          attribute.allowableValues.valueType &&
          attribute.allowableValues.valueType === "List" &&
          attribute.allowableValues.values &&
          attribute.allowableValues.values.length
            ? (attribute.allowableValues.values as any)
            : undefined,
        pattern:
          attribute.allowableValues &&
          attribute.allowableValues.valueType === "RegExp" &&
          attribute.allowableValues.match
            ? attribute.allowableValues.match.replace(
                /^\/(.*?)\/([gism]+)?$/,
                "$1"
              )
            : undefined,
        default:
          attribute.defaultValue || attribute.defaultValue === 0
            ? attribute.defaultValue
            : undefined
      };

    case "Mixed":
      // TODO should be oneOf ?
      return {
        type: "object",
        title: attribute.title,
        description: attribute.description,
        // @ts-ignore
        additionalProperties: true
      };

    default:
      return {
        $ref: `#/definitions/${attribute.type}`
      };
  }
}

export const parseEntityTypeDefinition = (entityType: ICbEntity) => {
  const definition: Schema = {
    type: "object",
    description: entityType.description,
    properties: {
      _id: {
        $ref: "#/definitions/ObjectId"
      }
    },
    required: []
  };
  definition.properties = definition.properties || {};

  if (entityType.isResource) {
    definition.properties.updatedAt = {
      type: "string",
      format: "date-time"
    };
    definition.properties.updatedBy = {
      type: "string"
    };
  }

  entityType.attributes.map(attribute => {
    definition.properties = definition.properties || {};
    definition.properties[attribute.title] = parseAttribute(attribute);
    if (attribute.isRequired && definition.required) {
      definition.required.push(attribute.title);
    }
  });
  if (definition.required && !definition.required.length) {
    definition.required = undefined;
  }
  return definition;
};

// TODO split responses to spec.response for a more generic spec?
export const parseEntityTypePaths /*: { [title: string]: Path }*/ = (
  entityType: ICbEntity
) => {
  return {
    [`/${entityType.title}.json/crud`]: {
      get: {
        description: `Returns a list of "${entityType.title}"`,
        parameters: [
          {
            name: "token",
            in: "query",
            type: "string",
            required: true
          }
        ],
        responses: {
          "200": {
            description: "OK",
            schema: {
              type: "array",
              items: {
                $ref: `#/definitions/${entityType.title}`
              }
            }
          }
        }
      },
      post: {
        description: `Creates a new "${entityType.title}". Returns the "${
          entityType.title
        }" with ID and any server-side modifications and validations`,
        parameters: [
          {
            name: "token",
            in: "query",
            type: "string",
            required: true
          }
        ],
        responses: {
          "200": {
            description: "OK",
            schema: {
              $ref: `#/definitions/${entityType.title}`
            }
          }
        }
      }
    },
    [`/${entityType.title}.json/crud/{id}`]: {
      get: {
        description: `Get a ${entityType.title}`,
        parameters: [
          {
            name: "token",
            in: "query",
            type: "string",
            required: true
          }
        ],
        responses: {
          "200": {
            description: "OK",
            schema: {
              $ref: `#/definitions/${entityType.title}`
            }
          }
        }
      },
      put: {
        description: `Update an existing "${entityType.title}". Returns the "${
          entityType.title
        }" with any server-side modifications.`,
        parameters: [
          {
            name: "token",
            in: "query",
            type: "string",
            required: true
          }
        ],
        responses: {
          "200": {
            description: "OK",
            schema: {
              $ref: `#/definitions/${entityType.title}`
            }
          }
        }
      },
      delete: {
        description: `Removes a "${
          entityType.title
        }". Response is a JSON object, containing a property "success" with value true in case of a successful delete`,
        parameters: [
          {
            name: "token",
            in: "query",
            type: "string",
            required: true
          }
        ],
        responses: {
          "200": {
            description: "OK",
            schema: {
              type: "object",
              properties: {
                success: {
                  type: "boolean"
                }
              }
            }
          }
        }
      }
    },
    [`/${entityType.title}.json/search`]: {
      post: {
        description: `Search is just like regular "/${
          entityType.title
        }.json/crud" GET operations, but may POST a more complex query. Returns a list of "${
          entityType.title
        }"`,
        responses: {
          "200": {
            description: "OK",
            schema: {
              type: "array",
              items: {
                $ref: `#/definitions/${entityType.title}`
              }
            }
          }
        }
      }
    }
  };
};
