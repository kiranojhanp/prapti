import { describe, test, expect, beforeAll } from "bun:test";
import { Prapti, adapters, prapti } from "../src/index";
import { z } from "zod";

// Zod schemas for JSONPlaceholder API
const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  username: z.string(),
  email: z.string().email(),
  address: z.object({
    street: z.string(),
    suite: z.string(),
    city: z.string(),
    zipcode: z.string(),
    geo: z.object({
      lat: z.string(),
      lng: z.string(),
    }),
  }),
  phone: z.string(),
  website: z.string(),
  company: z.object({
    name: z.string(),
    catchPhrase: z.string(),
    bs: z.string(),
  }),
});

const PostSchema = z.object({
  userId: z.number(),
  id: z.number(),
  title: z.string(),
  body: z.string(),
});

const CreatePostSchema = z.object({
  title: z.string().min(1, "Title is required"),
  body: z.string().min(1, "Body is required"),
  userId: z.number().positive("User ID must be positive"),
});

const CommentSchema = z.object({
  postId: z.number(),
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
  body: z.string(),
});

const TodoSchema = z.object({
  userId: z.number(),
  id: z.number(),
  title: z.string(),
  completed: z.boolean(),
});

describe("Prapti with Zod and JSONPlaceholder", () => {
  let prapti: Prapti<z.ZodSchema>;

  beforeAll(() => {
    prapti = new Prapti(adapters.zod);
  });

  describe("GET requests with type inference", () => {
    test("should fetch a single user with full type safety", async () => {
      const response = await prapti.fetch(
        "https://jsonplaceholder.typicode.com/users/1",
        {
          validate: { response: { body: UserSchema } },
        }
      );

      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);

      const user = await response.json(); // Type: z.infer<typeof UserSchema>

      // Full type safety - these properties are guaranteed to exist
      expect(user.id).toBe(1);
      expect(typeof user.name).toBe("string");
      expect(typeof user.email).toBe("string");
      expect(user.email).toContain("@");
      expect(typeof user.username).toBe("string");
      expect(typeof user.address.city).toBe("string");
      expect(typeof user.company.name).toBe("string");
    });

    test("should fetch all users as array", async () => {
      const UsersArraySchema = z.array(UserSchema);

      const response = await prapti.fetch(
        "https://jsonplaceholder.typicode.com/users",
        {
          validate: { response: { body: UsersArraySchema } },
        }
      );

      expect(response.ok).toBe(true);
      const users = await response.json(); // Type: User[]

      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBe(10);

      // Type-safe access to first user
      const firstUser = users[0];
      expect(firstUser?.id).toBe(1);
      expect(typeof firstUser?.name).toBe("string");
    });

    test("should fetch a single post with validation", async () => {
      const response = await prapti.fetch(
        "https://jsonplaceholder.typicode.com/posts/1",
        {
          validate: { response: { body: PostSchema } },
        }
      );

      expect(response.ok).toBe(true);
      const post = await response.json(); // Type: z.infer<typeof PostSchema>

      expect(post.id).toBe(1);
      expect(post.userId).toBe(1);
      expect(typeof post.title).toBe("string");
      expect(typeof post.body).toBe("string");
      expect(post.title.length).toBeGreaterThan(0);
    });

    test("should fetch comments for a post", async () => {
      const CommentsArraySchema = z.array(CommentSchema);

      const response = await prapti.fetch(
        "https://jsonplaceholder.typicode.com/posts/1/comments",
        {
          validate: { response: { body: CommentsArraySchema } },
        }
      );

      expect(response.ok).toBe(true);
      const comments = await response.json(); // Type: Comment[]

      expect(Array.isArray(comments)).toBe(true);
      expect(comments.length).toBeGreaterThan(0);

      const firstComment = comments[0];
      expect(firstComment?.postId).toBe(1);
      expect(typeof firstComment?.email).toBe("string");
      expect(firstComment?.email).toContain("@");
    });

    test("should fetch todos with boolean validation", async () => {
      const TodosArraySchema = z.array(TodoSchema);

      const response = await prapti.fetch(
        "https://jsonplaceholder.typicode.com/todos",
        {
          validate: { response: { body: TodosArraySchema } },
        }
      );

      expect(response.ok).toBe(true);
      const todos = await response.json(); // Type: Todo[]

      expect(Array.isArray(todos)).toBe(true);
      expect(todos.length).toBe(200);

      const firstTodo = todos[0];
      expect(typeof firstTodo?.completed).toBe("boolean");
      expect(firstTodo?.userId).toBe(1);
    });

    test("should handle 404 errors gracefully", async () => {
      const response = await prapti.fetch(
        "https://jsonplaceholder.typicode.com/users/999",
        {
          validate: { response: { body: UserSchema } },
        }
      );

      expect(response.status).toBe(404);
      expect(response.ok).toBe(false);
    });
  });

  describe("POST requests with request/response validation", () => {
    test("should create a new post with full validation", async () => {
      const newPostData = {
        title: "My New Post",
        body: "This is the content of my new post",
        userId: 1,
      };

      const response = await prapti.fetch(
        "https://jsonplaceholder.typicode.com/posts",
        {
          method: "POST",
          body: newPostData,
          validate: { request: { body: CreatePostSchema }, response: { body: PostSchema } },
        }
      );

      expect(response.ok).toBe(true);
      expect(response.status).toBe(201);

      const createdPost = await response.json(); // Type: z.infer<typeof PostSchema>

      expect(createdPost.title).toBe(newPostData.title);
      expect(createdPost.body).toBe(newPostData.body);
      expect(createdPost.userId).toBe(newPostData.userId);
      expect(typeof createdPost.id).toBe("number");
      expect(createdPost.id).toBe(101); // JSONPlaceholder returns 101 for new posts
    });

    test("should validate request data and reject invalid input", async () => {
      const invalidPostData = {
        title: "", // Empty title should fail validation
        body: "Valid body",
        userId: -1, // Negative userId should fail validation
      };

      await expect(
        prapti.fetch("https://jsonplaceholder.typicode.com/posts", {
          method: "POST",
          body: invalidPostData,
          validate: { request: { body: CreatePostSchema } },
        })
      ).rejects.toThrow(); // Zod validation error
    });
  });

  describe("PUT/PATCH requests", () => {
    test("should update a post with validation", async () => {
      const UpdatePostSchema = PostSchema.partial().extend({
        id: z.number(),
      });

      const updateData = {
        id: 1,
        title: "Updated Post Title",
        body: "This post has been updated",
        userId: 1,
      };

      const response = await prapti.fetch(
        "https://jsonplaceholder.typicode.com/posts/1",
        {
          method: "PUT",
          body: updateData,
          validate: { request: { body: UpdatePostSchema }, response: { body: PostSchema } },
        }
      );

      expect(response.ok).toBe(true);
      const updatedPost = await response.json(); // Type: z.infer<typeof PostSchema>

      expect(updatedPost.id).toBe(1);
      expect(updatedPost.title).toBe(updateData.title);
      expect(updatedPost.body).toBe(updateData.body);
    });
  });

  describe("DELETE requests", () => {
    test("should delete a post", async () => {
      const response = await prapti.fetch(
        "https://jsonplaceholder.typicode.com/posts/1",
        {
          method: "DELETE",
        }
      );

      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
    });
  });

  describe("Error handling with Zod validation", () => {
    test("should handle network errors", async () => {
      await expect(
        prapti.fetch("https://nonexistent-domain-12345.com/api")
      ).rejects.toThrow();
    });

    test("should throw Zod validation errors for invalid response data", async () => {
      // Create a schema that will fail validation
      const StrictUserSchema = UserSchema.extend({
        invalidField: z.string(), // This field doesn't exist in JSONPlaceholder response
      });

      const response = await prapti.fetch(
        "https://jsonplaceholder.typicode.com/users/1",
        {
          validate: { response: { body: StrictUserSchema } },
        }
      );

      await expect(response.json()).rejects.toThrow(); // Should throw ZodError
    });

    test("should validate email format in user schema", async () => {
      const InvalidEmailUserSchema = z.object({
        id: z.number(),
        name: z.string(),
        email: z
          .string()
          .email()
          .refine((email) => email.includes("invalid"), {
            message: "Email must contain 'invalid'",
          }),
      });

      const response = await prapti.fetch(
        "https://jsonplaceholder.typicode.com/users/1",
        {
          validate: { response: { body: InvalidEmailUserSchema } },
        }
      );

      await expect(response.json()).rejects.toThrow();
    });
  });

  describe("Response type methods with validation", () => {
    test("should handle text response", async () => {
      const response = await prapti.fetch(
        "https://jsonplaceholder.typicode.com/posts/1"
      );
      const textData = await response.text();

      expect(typeof textData).toBe("string");
      expect(textData).toContain("userId");
    });

    test("should handle blob response", async () => {
      const response = await prapti.fetch(
        "https://jsonplaceholder.typicode.com/posts/1"
      );
      const blobData = await response.blob();

      expect(blobData).toBeInstanceOf(Blob);
    });
  });
});

describe("prapti factory function", () => {
  let praptiInstance: Prapti<z.ZodSchema>;

  beforeAll(() => {
    praptiInstance = new Prapti(adapters.zod);
  });

  test("should create prapti instance with Zod adapter", () => {
    const instance = prapti(adapters.zod);
    expect(instance).toBeInstanceOf(Prapti);
  });

  test("should work with created instance", async () => {
    const instance = prapti(adapters.zod);

    const response = await instance.fetch(
      "https://jsonplaceholder.typicode.com/users/1",
      {
        validate: { response: { body: UserSchema } },
      }
    );

    expect(response.ok).toBe(true);
    const user = await response.json(); // Fully typed
    expect(user.id).toBe(1);
  });
});

describe("Advanced Zod schema features", () => {
  let prapti: Prapti<z.ZodSchema>;

  beforeAll(() => {
    prapti = new Prapti(adapters.zod);
  });

  test("should handle optional fields", async () => {
    const PartialUserSchema = UserSchema.partial();

    const response = await prapti.fetch(
      "https://jsonplaceholder.typicode.com/users/1",
      {
        validate: { response: { body: PartialUserSchema } },
      }
    );

    const user = await response.json(); // All fields optional
    expect(user.id).toBe(1); // Still present in actual response
  });

  test("should handle schema transformations", async () => {
    const TransformedPostSchema = PostSchema.transform((post) => ({
      ...post,
      titleLength: post.title.length,
      isLongPost: post.body.length > 100,
    }));

    const response = await prapti.fetch(
      "https://jsonplaceholder.typicode.com/posts/1",
      {
        validate: { response: { body: TransformedPostSchema } },
      }
    );

    const transformedPost = await response.json();
    expect(transformedPost.titleLength).toBe(transformedPost.title.length);
    expect(typeof transformedPost.isLongPost).toBe("boolean");
  });

  test("should handle union schemas", async () => {
    const UserOrPostSchema = z.union([UserSchema, PostSchema]);

    const response = await prapti.fetch(
      "https://jsonplaceholder.typicode.com/posts/1",
      {
        validate: { response: { body: UserOrPostSchema } },
      }
    );

    const data = await response.json(); // Type: User | Post
    expect(data.id).toBe(1);
  });
});
