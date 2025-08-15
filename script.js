// Initialize IndexedDB
let db;
const DB_NAME = "SocialMediaDB";
const DB_VERSION = 2; // Incremented version for schema updates
const USER_STORE = "users";
const POST_STORE = "posts";
const COMMENT_STORE = "comments";

// Open or create the database
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      db = event.target.result;
      
      // Create user store
      if (!db.objectStoreNames.contains(USER_STORE)) {
        const userStore = db.createObjectStore(USER_STORE, { keyPath: "email" });
        userStore.createIndex("username", "username", { unique: true });
      }
      
      // Create post store
      if (!db.objectStoreNames.contains(POST_STORE)) {
        const postStore = db.createObjectStore(POST_STORE, { keyPath: "id", autoIncrement: true });
        postStore.createIndex("userEmail", "userEmail", { unique: false });
      } else {
        // For existing databases, add likes field if not present
        const postStore = event.target.transaction.objectStore(POST_STORE);
        if (!postStore.indexNames.contains("likes")) {
          postStore.createIndex("likes", "likes", { unique: false });
        }
      }
      
      // Create comment store
      if (!db.objectStoreNames.contains(COMMENT_STORE)) {
        const commentStore = db.createObjectStore(COMMENT_STORE, { keyPath: "id", autoIncrement: true });
        commentStore.createIndex("postId", "postId", { unique: false });
      }
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      resolve(db);
    };

    request.onerror = (event) => {
      reject("Error opening database");
    };
  });
}

// Check if user is logged in (using localStorage)
function checkAuth() {
  const user = localStorage.getItem("currentUser");
  if (!user && window.location.pathname.endsWith("index.html")) {
    window.location.href = "login.html";
  }
}

// Signup Function
document.getElementById("signupForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const username = document.getElementById("username").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  
  try {
    await initDB();
    const transaction = db.transaction(USER_STORE, "readwrite");
    const store = transaction.objectStore(USER_STORE);
    
    const user = { username, email, password };
    store.add(user);
    
    alert("Signup successful! Please login.");
    window.location.href = "login.html";
  } catch (error) {
    alert("Error: " + error.message);
  }
});

// Login Function
document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;
  
  try {
    await initDB();
    const transaction = db.transaction(USER_STORE, "readonly");
    const store = transaction.objectStore(USER_STORE);
    const request = store.get(email);
    
    request.onsuccess = (e) => {
      const user = e.target.result;
      if (user && user.password === password) {
        localStorage.setItem("currentUser", JSON.stringify(user));
        window.location.href = "index.html";
      } else {
        alert("Invalid credentials!");
      }
    };
  } catch (error) {
    alert("Error: " + error.message);
  }
});

// Logout Function
document.getElementById("logoutBtn")?.addEventListener("click", () => {
  localStorage.removeItem("currentUser");
  window.location.href = "login.html";
});

// Create Post
document.getElementById("postBtn")?.addEventListener("click", async () => {
  const content = document.getElementById("postContent").value;
  if (!content) return;
  
  const user = JSON.parse(localStorage.getItem("currentUser"));
  if (!user) {
    alert("Please login first!");
    return;
  }
  
  try {
    await initDB();
    const transaction = db.transaction(POST_STORE, "readwrite");
    const store = transaction.objectStore(POST_STORE);
    
    const post = {
      userEmail: user.email,
      username: user.username,
      content,
      timestamp: new Date().toISOString(),
      likes: 0 // Initialize likes count
    };
    
    store.add(post);
    document.getElementById("postContent").value = "";
    loadPosts();
  } catch (error) {
    alert("Error posting: " + error.message);
  }
});

// Like a Post
async function likePost(postId) {
  try {
    await initDB();
    const transaction = db.transaction(POST_STORE, "readwrite");
    const store = transaction.objectStore(POST_STORE);
    const request = store.get(postId);
    
    request.onsuccess = (e) => {
      const post = e.target.result;
      post.likes = (post.likes || 0) + 1;
      store.put(post);
      loadPosts(); // Refresh the feed to show updated like count
    };
  } catch (error) {
    console.error("Error liking post:", error);
  }
}

// Add Comment
async function addComment(postId, content) {
  const user = JSON.parse(localStorage.getItem("currentUser"));
  if (!user) return;

  try {
    await initDB();
    const transaction = db.transaction(COMMENT_STORE, "readwrite");
    const store = transaction.objectStore(COMMENT_STORE);
    
    const comment = {
      postId,
      userEmail: user.email,
      username: user.username,
      content,
      timestamp: new Date().toISOString()
    };
    
    store.add(comment);
    loadComments(postId); // Refresh comments for this post
  } catch (error) {
    console.error("Error adding comment:", error);
  }
}

// Load Comments for a Post
async function loadComments(postId) {
  try {
    await initDB();
    const transaction = db.transaction(COMMENT_STORE, "readonly");
    const store = transaction.objectStore(COMMENT_STORE);
    const index = store.index("postId");
    const request = index.getAll(postId);
    
    request.onsuccess = (e) => {
      const comments = e.target.result;
      const commentList = document.querySelector(`.commentList[data-post-id="${postId}"]`);
      if (commentList) {
        commentList.innerHTML = "";
        comments.forEach(comment => {
          commentList.innerHTML += `
            <div class="comment">
              <strong>${comment.username}</strong>: ${comment.content}
              <small>${new Date(comment.timestamp).toLocaleTimeString()}</small>
            </div>
          `;
        });
      }
    };
  } catch (error) {
    console.error("Error loading comments:", error);
  }
}

// Load Posts with Interactive Elements
async function loadPosts() {
  try {
    await initDB();
    const transaction = db.transaction(POST_STORE, "readonly");
    const store = transaction.objectStore(POST_STORE);
    const request = store.getAll();
    
    request.onsuccess = (e) => {
      const posts = e.target.result;
      const postsContainer = document.getElementById("postsContainer");
      postsContainer.innerHTML = "";
      
      posts.reverse().forEach(post => {
        const postElement = document.createElement("div");
        postElement.className = "post";
        postElement.innerHTML = `
          <h3>${post.username}</h3>
          <p>${post.content}</p>
          <small>${new Date(post.timestamp).toLocaleString()}</small>
          <div class="post-actions">
            <button class="likeBtn" data-post-id="${post.id}">❤️ ${post.likes || 0}</button>
          </div>
          <div class="comments">
            <form class="commentForm" data-post-id="${post.id}">
              <input type="text" placeholder="Add a comment..." required>
              <button type="submit">Post</button>
            </form>
            <div class="commentList" data-post-id="${post.id}"></div>
          </div>
        `;
        postsContainer.appendChild(postElement);
      });

      // Add event listeners for new elements
      document.querySelectorAll(".likeBtn").forEach(btn => {
        btn.addEventListener("click", (e) => {
          const postId = parseInt(e.target.getAttribute("data-post-id"));
          likePost(postId);
        });
      });

      document.querySelectorAll(".commentForm").forEach(form => {
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          const postId = parseInt(e.target.getAttribute("data-post-id"));
          const content = e.target.querySelector("input").value;
          if (content.trim()) {
            addComment(postId, content.trim());
            e.target.querySelector("input").value = "";
          }
        });
      });

      // Load comments for each post
      posts.forEach(post => {
        loadComments(post.id);
      });
    };
  } catch (error) {
    console.error("Error loading posts:", error);
  }
}

// Auto-refresh posts every 5 seconds
function startAutoRefresh() {
  if (window.location.pathname.endsWith("index.html")) {
    setInterval(loadPosts, 5000);
  }
}

// Check auth on page load and initialize
window.addEventListener("DOMContentLoaded", () => {
  checkAuth();
  if (window.location.pathname.endsWith("index.html")) {
    loadPosts();
    startAutoRefresh();
  }
});