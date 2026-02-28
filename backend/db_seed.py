from database import get_collection

collection = get_collection()

def seed_database():
    problems = [
        "Find the longest consecutive sequence of elements in an unsorted array."
    ]
    
    # The optimized C++ code stored as a string
    optimized_cpp_code = """
#include <vector>
#include <unordered_set>
#include <algorithm>
using namespace std;

int longestConsecutive(vector<int>& nums) {
    unordered_set<int> numSet(nums.begin(), nums.end());
    int longestStreak = 0;
    for (int num : numSet) {
        if (numSet.find(num - 1) == numSet.end()) {
            int currentNum = num;
            int currentStreak = 1;
            while (numSet.find(currentNum + 1) != numSet.end()) {
                currentNum += 1;
                currentStreak += 1;
            }
            longestStreak = max(longestStreak, currentStreak);
        }
    }
    return longestStreak;
}
"""

    metadatas = [
        {
            "problem_type": "Array / Hash Map",
            "naive_complexity": "O(n log n)",
            "optimized_complexity": "O(n)",
            "language": "C++",
            "explanation": "Upgraded to O(n) using an unordered_set to track streaks without sorting.",
            "code_snippet": optimized_cpp_code,
            "tokens_used": 0,
            "execution_time_ms": 15
        }
    ]
    
    ids = ["algo_array_001"]

    collection.add(
        documents=problems,
        metadatas=metadatas,
        ids=ids
    )
    print("Database seeded successfully with optimized algorithms!")

if __name__ == "__main__":
    seed_database()