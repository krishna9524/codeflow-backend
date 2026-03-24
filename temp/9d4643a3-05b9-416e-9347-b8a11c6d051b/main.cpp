#include <vector>
#include <climits>
using namespace std;

class Solution {
public:
    int findLargest(vector<int>& nums) {
        int maxNum = INT_MIN; // initialize to smallest possible value
        
        for (int num : nums) {
            if (num > maxNum)
                maxNum = num;
        }
        
        return maxNum;
    }
};

#include <iostream>
#include <vector>
#include <sstream>
#include <algorithm>
#include <json/json.h>
int main() {
    std::string line; std::getline(std::cin, line);
    Json::Value root; Json::Reader reader;
    reader.parse(line, root);
    std::vector<int> nums;
    for (auto& num : root["nums"]) nums.push_back(num.asInt());
    Solution sol; int result = sol.findLargest(nums);
    std::cout << result; return 0;
}