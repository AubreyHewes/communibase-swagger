import { Connector } from "communibase-connector-js";
import { Path, Schema, Spec } from "swagger-schema-official";
import { parse } from "url";
import { ICbEntity, parseEntityTypeDefinition, parseEntityTypePaths } from "./parser";

export interface ICBSwaggerGeneratorOptions {
  apiKey: string;
  serviceUrl?: string;
}

export default async ({
  apiKey,
  serviceUrl
}: ICBSwaggerGeneratorOptions): Promise<Spec> => {
  if (!apiKey) {
    throw new Error("Missing Communibase API key");
  }
  const cbc = new Connector(apiKey);
  if (serviceUrl) {
    cbc.setServiceUrl(serviceUrl);
  }
  const entityTypes: ICbEntity[] = [
    {
      title: "EntityType",
      attributes: [
        {
          title: "_id",
          type: "ObjectId"
        }
      ],
      isResource: true
    }
  ].concat(await cbc.getAll<ICbEntity>("EntityType"));

  let paths: { [title: string]: Path } = {
  };

  const definitions: { [title: string]: Schema } = {
    ObjectId: {
      type: "string",
      minLength: 24,
      maxLength: 24
    }
  };

  entityTypes.forEach(entityType => {
    if (entityType.isResource) {
      paths = { ...paths, ...parseEntityTypePaths(entityType)} as any; // hmz
    }
    definitions[entityType.title] = parseEntityTypeDefinition(entityType);
  });

  // TODO get from Connector.getServiceUrl ? (though needs to be exposed)
  const url = parse(serviceUrl || "https://api.communibase.nl/0.1/");

  // TODO support other openapi specifications
  return {
    swagger: "2.0",
    info: {
      version: (url.pathname as string).replace(/\//g, ""),
      title: "Communibase API for X",
      description: "A RESTful API for Communibase administration X"
    },
    host: url.host,
    basePath: url.pathname,
    tags: [],
    schemes: [(url.protocol as string).replace(":", "")],
    consumes: ["application/json"],
    produces: ["application/json"],

    securityDefinitions: {
      token_in_query: {
        type: "apiKey",
        name: "token",
        in: "query"
      }
    },

    paths,
    definitions
  };
};
