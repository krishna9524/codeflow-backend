#include <vector>
using namespace std;
class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        return {};
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
    int target = root["target"].asInt();
    Solution sol; std::vector<int> result = sol.twoSum(nums, target);
    std::cout << '['; for (size_t i = 0; i < result.size(); ++i) { std::cout << result[i]; if (i + 1 < result.size()) std::cout << ','; } std::cout << ']'; return 0;
}