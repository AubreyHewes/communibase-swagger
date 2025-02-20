import { Connector } from "communibase-connector-js";
import { writeFileSync } from "fs";
import { resolve } from "path";

if (!process.argv[2]) {
  throw new Error("Missing Communibase key");
  process.exit(1);
}

const outputFileName = process.argv[3] || "swagger.json";

const cbc = new Connector(process.argv[2]);

interface ICbEntity {
  title: string;
  type: "object";
  attributes: ICbAttribute[];
  isResource: boolean;
}

interface ICbAttribute {
  allowableValues?: string[];
  type: string;
  items?: string;
  minLength?: number;
  maxLength?: number;
  title: string;
  isRequired?: boolean;
}

interface ISwaggerDefinition {
  type: string;
  properties: {
    [property: string]: ISwaggerProperty;
  };
  required?: string[];
}

interface ISwaggerProperty {
  type?: string;
  items?: ISwaggerProperty;
  format?: string;
  minLength?: number;
  maxLength?: number;
  enum?: any[];
  additionalProperties?: boolean;
  $ref?: string;
}

function getSwaggerProperty(attribute: ICbAttribute): ISwaggerProperty {
  switch (attribute.type) {
    case "Array":
      return {
        type: "array",
        items: getSwaggerProperty({
          type: attribute.items as string,
          title: ""
        })
      };

    case "Date":
      return {
        type: "string",
        format: "date-time"
      };

    case "ObjectId":
      return {
        type: "string",
        minLength: 24,
        maxLength: 24
      };

    case "int":
      return {
        type: "integer"
      };

    case "float":
      return {
        type: "number"
      };

    case "array":
    case "boolean":
    case "integer":
    case "null":
    case "number":
    case "object":
    case "string":
      return {
        type: attribute.type,
        enum:
          attribute.allowableValues &&
          attribute.allowableValues.values &&
          attribute.allowableValues.values.length
            ? (attribute.allowableValues.values as any)
            : undefined
      };

    case "Mixed":
      return {
        type: "object",
        additionalProperties: true
      };

    default:
      return {
        $ref: `#/definitions/${attribute.type}`
      };
  }
}

cbc
  .getAll<ICbEntity>("EntityType")
  .then(entityTypes => {
    const definitions: { [title: string]: ISwaggerDefinition } = {};
    entityTypes.forEach(entityType => {
      const definition: ISwaggerDefinition = {
        type: "object",
        properties: {
          _id: {
            type: "string",
            minLength: 24,
            maxLength: 24
          }
        },
        required: []
      };

      if (entityType.isResource) {
        definition.properties.updatedAt = {
          type: "string",
          format: "date-time"
        };
        definition.properties.updatedBy = {
          type: "string"
        };
      }

      definitions[entityType.title] = definition;
      entityType.attributes.map(attribute => {
        definition.properties[attribute.title] = getSwaggerProperty(attribute);
        if (attribute.isRequired && definition.required) {
          definition.required.push(attribute.title);
        }
      });
      if (definition.required && !definition.required.length) {
        definition.required = undefined;
      }
    });

    const swagger = {
      swagger: "2.0",
      info: {
        version: "0.0.1",
        title: "CB API",
        description: "A RESTful API for Communibase"
      },
      host: "api.communibase.nl",
      basePath: "/v1",
      tags: [],
      schemes: ["https"],
      produces: ["application/json"],
      paths: {
        "/EntityType.json/crud": {
          get: {
            description: "Get all Entity types",
            parameters: [
              {
                name: "token",
                in: "query",
                type: "string",
                description: "A token as retrieved via /auth/login",
                required: true
              }
            ],
            responses: {
              "200": {
                description: "OK",
                schema: {
                  $ref: "#/definitions/EntityType"
                }
              }
            }
          }
        }
      },
      definitions
    };

    const path = resolve(outputFileName);
    writeFileSync(path, JSON.stringify(swagger, null, "\t"), {
      encoding: "utf8",
      flag: "w"
    });
    console.log(`Created ${path}`);
  })
  .catch(err => {
    console.log(err);
    process.exit(1);
  });
